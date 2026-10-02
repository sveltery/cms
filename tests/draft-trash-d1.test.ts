// Supplemental draft-only service evidence on a real local workerd/D1 binding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import type { CmsDatabase, DraftEntry } from '../src/lib/server/database/contract.ts';
const principal: ServerPrincipal = { id: 'owner', permissions: ['schema:manage', 'content:create', 'content:read', 'content:read_drafts', 'content:edit_own', 'content:delete_own'] };
const expected = (row: DraftEntry) => ({ version: row.version, updatedAt: row.updatedAt });
async function seed(database: CmsDatabase) {
  await migrateCms(database);
  const service = cmsService(database, principal);
  await service.createCollection({ slug: 'posts', label: 'Posts' });
  await service.addField({ collection: 'posts', expectedSchemaVersion: 1, input: { slug: 'title', label: 'Title', type: 'string' } });
  await service.addField({ collection: 'posts', expectedSchemaVersion: 2, input: { slug: 'body', label: 'Body', type: 'text' } });
  const rows = [];
  for (const locale of ['en', 'fr', 'de']) {
    const row = await service.createDraft({ type: 'posts', locale, slug: `hello-${locale}`, data: { title: locale, body: 'Retained\0data' } });
    await service.deleteDraft({ type: 'posts', id: row.id, locale, expected: expected(row) }); rows.push(row);
  }
  return { service, rows };
}
test('local D1: locales, concurrent restore, retained data and persisted restart', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-d1-'));
  let storage = await collectionUpdateStorage('D1', directory);
  try {
    const { service, rows } = await seed(storage.database);
    assert.deepEqual(new Set((await service.listTrashedDrafts({ type: 'posts' })).items.map(row => row.locale)), new Set(['en', 'fr', 'de']));
    assert.deepEqual((await service.listTrashedDrafts({ type: 'posts', locale: 'fr' })).items.map(row => row.slug), ['hello-fr']);
    const trash = await service.getTrashedDraft({ type: 'posts', id: rows[1].id });
    assert.equal(trash.locale, 'fr'); assert.equal(trash.data.body, 'Retained\0data');
    const input = { type: 'posts', id: trash.id, locale: 'fr', expected: expected(trash) };
    const outcomes = await Promise.allSettled([service.restoreDraft(input), service.restoreDraft(input)]);
    assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(row => row.status === 'rejected' && row.reason.code === 'CONFLICT').length, 1);
    const restored = outcomes.find(row => row.status === 'fulfilled'); assert.ok(restored && restored.status === 'fulfilled');
    assert.deepEqual(restored.value.data, trash.data); assert.equal(restored.value.version, trash.version + 1);
    assert.ok(restored.value.updatedAt > trash.updatedAt);
    assert.deepEqual(await service.getDraft({ type: 'posts', id: trash.id, locale: 'fr' }), restored.value);
    await storage.close(); storage = await collectionUpdateStorage('D1', directory);
    const reopened = cmsService(storage.database, principal);
    assert.deepEqual(await reopened.getDraft({ type: 'posts', id: trash.id, locale: 'fr' }), restored.value);
    assert.equal((await reopened.listTrashedDrafts({ type: 'posts' })).items.length, 2);
    await assert.rejects(() => reopened.restoreDraft(input), { code: 'CONFLICT' });
    assert.deepEqual(await storage.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
  } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
});
test('local D1: SQL ownership predicate and batch rollback protect retained trash', { timeout: 30000 }, async () => {
  const storage = await collectionUpdateStorage('D1');
  try {
    const { service, rows } = await seed(storage.database);
    const trash = await service.getTrashedDraft({ type: 'posts', id: rows[0].id });
    let raced = false;
    const racing: CmsDatabase = { ...storage.database, async atomicBatch(statements) {
      if (!raced) { raced = true; await sql`UPDATE ec_posts SET author_id = 'other' WHERE id = ${trash.id}`.execute(storage.database.db); }
      return storage.database.atomicBatch(statements);
    } };
    await assert.rejects(() => cmsService(racing, principal).restoreDraft({ type: 'posts', id: trash.id, expected: expected(trash) }), { code: 'CONFLICT' });
    const unchanged = await service.getTrashedDraft({ type: 'posts', id: trash.id });
    assert.equal(unchanged.authorId, 'other'); assert.equal(unchanged.deletedAt, trash.deletedAt); assert.equal(unchanged.version, trash.version);
    await sql`CREATE TRIGGER reject_restore BEFORE UPDATE ON ec_posts WHEN NEW.deleted_at IS NULL BEGIN SELECT RAISE(ABORT, 'unexpected_restore_failure'); END`.execute(storage.database.db);
    const before = (await sql`SELECT * FROM ec_posts ORDER BY id`.execute(storage.database.db)).rows;
    const any = cmsService(storage.database, { id: 'editor', permissions: ['content:edit_any'] });
    await assert.rejects(() => any.restoreDraft({ type: 'posts', id: trash.id, expected: expected(trash) }), /unexpected_restore_failure/);
    assert.deepEqual((await sql`SELECT * FROM ec_posts ORDER BY id`.execute(storage.database.db)).rows, before);
    assert.deepEqual(await storage.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
  } finally { await storage.close(); }
});
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: schema changed after restore preflight rolls back the guard and leaves trash intact`, { timeout: 30000 }, async () => {
    const storage = await collectionUpdateStorage(target);
    try {
      const { service, rows } = await seed(storage.database);
      const trash = await service.getTrashedDraft({ type: 'posts', id: rows[0].id });
      let raced = false;
      const racing: CmsDatabase = { ...storage.database, async atomicBatch(statements) {
        if (!raced) {
          raced = true;
          await service.addField({ collection: 'posts', expectedSchemaVersion: 3, input: { slug: 'extra', label: 'Extra', type: 'text' } });
        }
        return storage.database.atomicBatch(statements);
      } };
      await assert.rejects(() => cmsService(racing, principal).restoreDraft({ type: 'posts', id: trash.id, expected: expected(trash) }), { code: 'CONFLICT' });
      const retained = await service.getTrashedDraft({ type: 'posts', id: trash.id });
      assert.equal(retained.deletedAt, trash.deletedAt); assert.equal(retained.version, trash.version);
      assert.equal(retained.updatedAt, trash.updatedAt); assert.equal(retained.data.body, trash.data.body);
      assert.deepEqual(await storage.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
    } finally { await storage.close(); }
  });
}
