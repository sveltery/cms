import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { lifecycleService } from '../src/lib/server/database/lifecycle/service.ts';
import { precondition, withRevision } from '../src/lib/server/content/schema.ts';
import { EditorSession, type EditorRecord, type SavePayload } from '../src/lib/editor/session.ts';

// Original feature fixtures use one fixed principal and actual persisted storage.
// No production configuration, authentication algorithm or identity probe.
for (const target of ['Node', 'D1'] as const) {
  test(`${target} editor saves an actual scalar draft, publishes separately and recovers trash after restart`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'writable-editor-'));
    let storage = await schemaAdminStorage(target, directory);
    const principal = { id: 'writer', permissions: ['content:read', 'content:read_drafts', 'content:create', 'content:edit_any', 'content:delete_any', 'content:publish_any'] as const };
    try {
      await migrateCms(storage.database);
      const registry = new SchemaRegistry(storage.database);
      await registry.createCollection({ slug: 'stories', label: 'Stories', supports: ['drafts', 'revisions'] });
      await registry.createField('stories', { slug: 'title', label: 'Headline', type: 'string', required: true });
      await registry.createField('stories', { slug: 'body', label: 'Body', type: 'text' });
      let service = cmsService(storage.database, principal);
      const initial = withRevision(await service.createContent({ type: 'stories', locale: 'fr', data: { title: 'Initial', body: 'Original' } }));
      const session = new EditorSession(initial, true, { title: { kind: 'string', label: 'Headline' }, body: { kind: 'richText', label: 'Body' } });
      session.edit({ ...session.data, title: 'Edited', body: 'Écrit' });
      assert.equal(session.dirty, true);
      const save = async (payload: SavePayload) => withRevision(await service.updateContent({ type: 'stories', id: initial.id, locale: 'fr', data: payload.data, slug: payload.slug, expected: precondition({ collection: 'stories', id: initial.id, locale: 'fr', _rev: payload._rev! }), skipRevision: payload.autosave }));
      assert.equal(await session.save(save), true);
      assert.equal(session.dirty, false); assert.notEqual(session.revision, initial._rev);
      let saved = await service.getContent({ type: 'stories', id: initial.id, locale: 'fr' });
      assert.deepEqual(saved.data, { title: 'Edited', body: 'Écrit' });
      const lifecycle = lifecycleService(storage.database, principal);
      const published = await lifecycle.publish({ type: 'stories', id: initial.id, locale: 'fr', expected: { version: saved.version, updatedAt: saved.updatedAt } });
      assert.equal(published.status, 'published');
      session.receive(withRevision(await service.getContent({ type: 'stories', id: initial.id, locale: 'fr' })));
      session.edit({ ...session.data, title: 'First autosave' });
      assert.equal(await session.save(save, true), true);
      const first = await lifecycle.listRevisions({ type: 'stories', id: initial.id, locale: 'fr' });
      session.edit({ ...session.data, title: 'Second autosave' });
      assert.equal(await session.save(save, true), true);
      const second = await lifecycle.listRevisions({ type: 'stories', id: initial.id, locale: 'fr' });
      assert.equal(second.length, first.length);
      assert.equal(second[0].data.title, 'Second autosave');
      saved = await service.getContent({ type: 'stories', id: initial.id, locale: 'fr' });
      await service.deleteContent({ type: 'stories', id: initial.id, locale: 'fr', expected: { version: saved.version, updatedAt: saved.updatedAt } });
      assert.equal(await service.countTrashedContent({ type: 'stories', locale: 'fr' }), 1);
      await storage.close(); storage = await schemaAdminStorage(target, directory); service = cmsService(storage.database, principal);
      const trashed = await service.getTrashedContent({ type: 'stories', id: initial.id, locale: 'fr' });
      await service.restoreContent({ type: 'stories', id: initial.id, locale: 'fr', expected: { version: trashed.version, updatedAt: trashed.updatedAt } });
      assert.equal((await service.getContent({ type: 'stories', id: initial.id, locale: 'fr' })).data.title, 'Second autosave');
      assert.equal(await service.countTrashedContent({ type: 'stories', locale: 'fr' }), 0);
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });
}
const entry = (values: Partial<EditorRecord> = {}): EditorRecord => ({ id: 'story', type: 'stories', locale: 'en', _rev: 'old-token', status: 'draft', slug: 'story', data: { title: 'Original', body: 'Keep' }, ...values });
const fields = { title: { kind: 'string', label: 'Headline' } };
test('an accepted in-flight snapshot advances only its own baseline and preserves later keystrokes', async () => {
  const session = new EditorSession(entry(), true, fields); session.edit({ title: 'Sent', body: 'Keep' });
  let release!: (value: EditorRecord) => void; let sent!: SavePayload;
  const saving = session.save(payload => { sent = payload; return new Promise(resolve => { release = resolve; }); });
  assert.equal(session.pending, true);
  session.edit({ title: 'Typed while saving', body: 'Keep' });
  assert.equal(sent.data.title, 'Sent');
  release(entry({ _rev: 'new-token', data: sent.data }));
  assert.equal(await saving, true); assert.equal(session.pending, false);
  assert.equal(session.data.title, 'Typed while saving'); assert.equal(session.dirty, true); assert.equal(session.revision, 'new-token');
});
test('a background refresh preserves a dirty writer copy and its stale comparison token', () => {
  const session = new EditorSession(entry(), true, fields); session.edit({ title: 'My copy' });
  session.receive(entry({ _rev: 'other-token', data: { title: 'Other copy' } }));
  assert.equal(session.data.title, 'My copy'); assert.equal(session.revision, 'old-token'); assert.equal(session.dirty, true);
});
test('a conflict keeps the writer copy and stops autosave until an explicit save-anyway choice', async () => {
  const session = new EditorSession(entry(), true, fields); session.edit({ title: 'My copy' });
  assert.equal(await session.save(async () => { throw { status: 409, body: { code: 'CONFLICT', message: 'conflict' } }; }), false);
  assert.equal(session.conflict, true); assert.equal(session.data.title, 'My copy'); assert.equal(session.dirty, true);
  let writes = 0;
  assert.equal(await session.save(async () => { writes++; return entry(); }, true), false); assert.equal(writes, 0);
  session.acceptLatestToken(entry({ _rev: 'other-token', data: { title: 'Other copy' } }));
  assert.equal(session.data.title, 'My copy'); assert.equal(session.revision, 'other-token');
  assert.equal(await session.save(async payload => { assert.equal(payload._rev, 'other-token'); return entry({ _rev: 'saved-token', data: payload.data }); }), true);
});
test('terminal validation rejection stays dirty and is not autosaved again until content changes', async () => {
  const session = new EditorSession(entry(), true, fields); session.edit({ title: '' }); let writes = 0;
  const save = async () => { writes++; throw { status: 400, body: { code: 'VALIDATION_ERROR', message: 'raw', details: { issues: [{ path: 'title', code: 'required' }] } } }; };
  assert.equal(await session.save(save, true), false); assert.equal(session.dirty, true);
  assert.equal(session.error, 'Headline is required.');
  assert.equal(await session.save(save, true), false); assert.equal(writes, 1);
  session.edit({ title: 'Changed' }); assert.equal(await session.save(save, true), false); assert.equal(writes, 2);
});
test('pending submissions and read-only permissions cannot call a mutation twice', async () => {
  const session = new EditorSession(entry(), true, fields); session.edit({ title: 'Mine' });
  let release!: (value: EditorRecord) => void; let calls = 0;
  const save = async () => { calls++; return new Promise<EditorRecord>(resolve => { release = resolve; }); };
  const first = session.save(save); assert.equal(await session.save(save), false); assert.equal(calls, 1);
  release(entry()); await first;
  const readonly = new EditorSession(entry(), false, fields);
  assert.equal(await readonly.save(save), false); assert.equal(calls, 1);
});
