import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import { CmsError, type CmsDatabase, type DraftEntry } from '../src/lib/server/database/contract.ts';

// Supplemental draft-only assertions informed by EmDash 1.1.0, immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/tests/integration/content/trash-locale-filter.test.ts:57/65/75/83
// and e2e/tests/content-actions.spec.ts:629.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// These are service/Node fixtures, not ports of the published/revision or browser
// datasets, and do not earn complete upstream declaration/assertion credit.
const admin: ServerPrincipal = { id: 'admin', permissions: ['content:create', 'content:read',
  'content:read_drafts', 'content:edit_any', 'content:delete_any'] };
const editor: ServerPrincipal = { id: 'editor', permissions: ['content:edit_any'] };
const owner: ServerPrincipal = { id: 'author', permissions: ['content:create', 'content:edit_own', 'content:delete_own'] };
const expected = (entry: { version: number; updatedAt: string }) => ({ version: entry.version, updatedAt: entry.updatedAt });
async function fixture(path = ':memory:') {
  const database = openSqlite(path); await migrateCms(database);
  const registry = new SchemaRegistry(database);
  await registry.createCollection({ slug: 'posts', label: 'Posts' });
  await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
  await registry.createField('posts', { slug: 'body', label: 'Body', type: 'text' });
  return { database, registry, service: cmsService(database, admin) };
}
async function trash(service: ReturnType<typeof cmsService>, entry: DraftEntry) {
  await service.deleteDraft({ type: 'posts', id: entry.id, locale: entry.locale, expected: expected(entry) });
}
const rows = async (database: CmsDatabase) => (await sql`SELECT * FROM ec_posts ORDER BY id`.execute(database.db)).rows;
const guards = async (database: CmsDatabase) => database.db.selectFrom('_cms_guards').selectAll().execute();

test('draft trash: authorization precedes hostile input and every storage access', async () => {
  let touched = 0;
  const database = new Proxy({} as CmsDatabase, { get() { touched++; throw new Error('storage accessed'); } });
  const hostile = new Proxy({}, { get() { throw new Error('input accessed'); }, ownKeys() { throw new Error('input accessed'); } });
  for (const [principal, code] of [[null, 'UNAUTHENTICATED'], [{ id: '', permissions: admin.permissions }, 'UNAUTHENTICATED'],
    [{ id: 'reader', permissions: ['content:read'] }, 'FORBIDDEN'],
    [{ id: 'deleter', permissions: ['content:delete_own', 'content:delete_any'] }, 'FORBIDDEN']] as const) {
    const service = cmsService(database, principal);
    for (const run of [() => service.getTrashedDraft(hostile), () => service.listTrashedDrafts(hostile),
      () => service.restoreDraft(hostile)]) await assert.rejects(run, { code });
  }
  assert.equal(touched, 0);
});

test('draft trash: permitted malformed bounded inputs reject before storage', async () => {
  let touched = 0;
  const database = new Proxy({} as CmsDatabase, { get() { touched++; throw new Error('storage accessed'); } });
  const service = cmsService(database, admin);
  for (const input of [{}, { type: '../posts' }, { type: 'posts', locale: '' }, { type: 'posts', locale: 'a'.repeat(36) },
    { type: 'posts', limit: 0 }, { type: 'posts', limit: 1.5 }, { type: 'posts', limit: Infinity },
    { type: 'posts', limit: Number.MAX_SAFE_INTEGER + 1 }, { type: 'posts', cursor: 'unsupported' },
    { type: 'posts', authorId: 'forged' }]) await assert.rejects(() => service.listTrashedDrafts(input), { code: 'VALIDATION_ERROR' });
  for (const input of [{}, { type: 'posts', id: '' }, { type: 'posts', id: 'a'.repeat(129) },
    { type: 'posts', id: 'id', locale: 'en_US' }, { type: 'posts', id: 'id', authorId: 'forged' }]) {
    await assert.rejects(() => service.getTrashedDraft(input), { code: 'VALIDATION_ERROR' });
  }
  for (const precondition of [undefined, {}, { version: 0, updatedAt: '2026-01-01T00:00:00.000Z' },
    { version: 1, updatedAt: 'invalid' }, { version: 1, updatedAt: '2026-01-01T00:00:00.000Z', extra: true }]) {
    await assert.rejects(() => service.restoreDraft({ type: 'posts', id: 'id', expected: precondition }), { code: 'VALIDATION_ERROR' });
  }
  await assert.rejects(() => service.restoreDraft({ type: 'posts', id: 'id', expected: { version: 1, updatedAt: '2026-01-01T00:00:00.000Z' }, authorId: 'forged' }), { code: 'VALIDATION_ERROR' });
  assert.equal(touched, 0);
});

test('Node draft trash: explicit locale scopes, omitted locale includes every locale and item locale is retained', async () => {
  const f = await fixture();
  try {
    const entries: DraftEntry[] = [];
    for (const [locale, slug, title] of [['en', 'hello-en', 'Hello'], ['fr', 'hello-fr', 'Bonjour'], ['de', 'hallo-de', 'Hallo']]) {
      const entry = await f.service.createDraft({ type: 'posts', locale, slug, data: { title } });
      entries.push(entry); await trash(f.service, entry);
    }
    const active = await f.service.createDraft({ type: 'posts', locale: 'fr', data: { title: 'Active' } });
    assert.deepEqual((await f.service.listTrashedDrafts({ type: 'posts', locale: 'fr' })).items.map(item => item.slug), ['hello-fr']);
    assert.deepEqual(new Set((await f.service.listTrashedDrafts({ type: 'posts' })).items.map(item => item.slug)), new Set(['hello-en', 'hello-fr', 'hallo-de']));
    assert.equal((await f.service.listTrashedDrafts({ type: 'posts', locale: 'de' })).items[0]?.locale, 'de');
    assert.deepEqual((await f.service.listTrashedDrafts({ type: 'posts', locale: 'es' })).items, []);
    assert.equal((await f.service.getTrashedDraft({ type: 'posts', id: entries[1].id })).locale, 'fr');
    await assert.rejects(() => f.service.getTrashedDraft({ type: 'posts', id: entries[1].id, locale: 'en' }), { code: 'NOT_FOUND' });
    await assert.rejects(() => f.service.getTrashedDraft({ type: 'posts', id: active.id }), { code: 'NOT_FOUND' });
    await assert.rejects(() => f.service.getDraft({ type: 'posts', id: entries[0].id }), { code: 'NOT_FOUND' });
    assert.deepEqual((await f.service.listDrafts({ type: 'posts', locale: 'fr' })).items.map(item => item.id), [active.id]);
    await assert.rejects(() => f.service.getTrashedDraft({ type: 'posts', id: 'missing' }), { code: 'NOT_FOUND' });
    await assert.rejects(() => f.service.listTrashedDrafts({ type: 'missing' }), { code: 'NOT_FOUND' });
  } finally { await f.database.close(); }
});

test('Node draft trash: default 50 and cap 100, deletedAt/id descending, bounded body-free summaries', async () => {
  const f = await fixture();
  try {
    const entries = [];
    for (let index = 0; index < 103; index++) {
      const entry = await f.service.createDraft({ type: 'posts', data: { title: 't'.repeat(200), body: 'b'.repeat(100_000) } });
      entries.push(entry); await trash(f.service, entry);
    }
    await sql`UPDATE ec_posts SET deleted_at = '2026-01-01T00:00:00.000Z'`.execute(f.database.db);
    await sql`UPDATE ec_posts SET deleted_at = '2026-02-01T00:00:00.000Z' WHERE id = ${entries[0].id}`.execute(f.database.db);
    const ordered = [entries[0].id, ...entries.slice(1).map(entry => entry.id).sort().reverse()];
    assert.equal((await f.service.listTrashedDrafts({ type: 'posts' })).items.length, 50);
    const capped = await f.service.listTrashedDrafts({ type: 'posts', limit: 1000 });
    assert.equal(capped.items.length, 100);
    assert.deepEqual(capped.items.map(item => item.id), ordered.slice(0, 100));
    assert.equal(capped.items[0].deletedAt, '2026-02-01T00:00:00.000Z');
    assert.equal('data' in capped.items[0], false);
    assert.equal(JSON.stringify(capped).includes('bbbbbbbb'), false);
    assert.equal(capped.items[0].title?.length, 200);
    assert.equal((await f.service.listTrashedDrafts({ type: 'posts', limit: 1 })).items.length, 1);
  } finally { await f.database.close(); }
});

test('Node draft trash: restore retains stored columns and returns refreshed CAS even with frozen time', async t => {
  const f = await fixture();
  try {
    const created = await f.service.createDraft({ type: 'posts', locale: 'fr', slug: 'retained', data: { title: 'Title', body: null } });
    await sql`UPDATE ec_posts SET translation_group = 'retained-group' WHERE id = ${created.id}`.execute(f.database.db);
    await trash(f.service, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id, locale: 'fr' });
    assert.deepEqual(trashed.data, created.data); assert.ok(trashed.deletedAt);
    const before = (await rows(f.database))[0] as Record<string, unknown>;
    t.mock.timers.enable({ apis: ['Date'], now: new Date(trashed.updatedAt).getTime() });
    await assert.rejects(() => cmsService(f.database, editor).restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) }), { code: 'NOT_FOUND' });
    const restored = await cmsService(f.database, editor).restoreDraft({ type: 'posts', id: created.id, locale: 'fr', expected: expected(trashed) });
    assert.deepEqual(restored.data, created.data); assert.equal(restored.authorId, created.authorId);
    assert.equal(restored.slug, created.slug); assert.equal(restored.createdAt, created.createdAt);
    assert.equal(restored.locale, 'fr'); assert.equal(restored.status, 'draft');
    assert.equal(restored.version, trashed.version + 1);
    assert.equal(new Date(restored.updatedAt).getTime(), new Date(trashed.updatedAt).getTime() + 1);
    assert.equal('deletedAt' in restored, false);
    const after = (await rows(f.database))[0] as Record<string, unknown>;
    assert.deepEqual({ ...after }, { ...before, deleted_at: null, version: restored.version, updated_at: restored.updatedAt });
    assert.deepEqual(await f.service.getDraft({ type: 'posts', id: created.id, locale: 'fr' }), restored);
    assert.deepEqual((await f.service.listTrashedDrafts({ type: 'posts' })).items, []);
    await assert.rejects(() => f.service.getTrashedDraft({ type: 'posts', id: created.id }), { code: 'NOT_FOUND' });
    await assert.rejects(() => f.service.updateDraft({ type: 'posts', id: created.id, locale: 'fr', expected: expected(trashed), data: {} }), { code: 'CONFLICT' });
    assert.deepEqual(await guards(f.database), []);
  } finally { t.mock.timers.reset(); await f.database.close(); }
});

test('Node draft trash: restore uses edit-own/any, persisted nonempty owner and no delete requirement', async () => {
  const f = await fixture();
  try {
    const owned = cmsService(f.database, owner);
    const created = await owned.createDraft({ type: 'posts', data: { title: 'Owned' } }); await trash(owned, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    const before = await rows(f.database);
    const stranger = cmsService(f.database, { id: 'stranger', permissions: ['content:edit_own'] });
    await assert.rejects(() => stranger.restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) }), { code: 'FORBIDDEN' });
    await assert.rejects(() => cmsService(f.database, { id: 'author', permissions: ['content:delete_any'] }).restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) }), { code: 'FORBIDDEN' });
    assert.deepEqual(await rows(f.database), before);
    const restored = await cmsService(f.database, { id: 'author', permissions: ['content:edit_own'] }).restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) });
    assert.equal(restored.authorId, 'author');
    await trash(f.service, restored);
    await sql`UPDATE ec_posts SET author_id = NULL WHERE id = ${created.id}`.execute(f.database.db);
    const ownerless = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    await assert.rejects(() => owned.restoreDraft({ type: 'posts', id: created.id, expected: expected(ownerless) }), { code: 'FORBIDDEN' });
    assert.equal((await cmsService(f.database, editor).restoreDraft({ type: 'posts', id: created.id, expected: expected(ownerless) })).authorId, null);
  } finally { await f.database.close(); }
});

test('Node draft trash: stale tokens conflict without writes, active restore conflicts and missing restores are NOT_FOUND', async () => {
  const f = await fixture();
  try {
    const created = await f.service.createDraft({ type: 'posts', data: { title: 'Retained' } }); await trash(f.service, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id }); const before = await rows(f.database);
    for (const precondition of [expected(created), { ...expected(trashed), version: trashed.version + 1 },
      { ...expected(trashed), updatedAt: '2000-01-01T00:00:00.000Z' }]) {
      await assert.rejects(() => f.service.restoreDraft({ type: 'posts', id: created.id, expected: precondition }), { code: 'CONFLICT' });
    }
    assert.deepEqual(await rows(f.database), before);
    const restored = await f.service.restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) });
    await assert.rejects(() => f.service.restoreDraft({ type: 'posts', id: created.id, expected: expected(restored) }), { code: 'CONFLICT' });
    await assert.rejects(() => f.service.restoreDraft({ type: 'posts', id: 'missing', expected: expected(restored) }), { code: 'NOT_FOUND' });
    assert.deepEqual(await f.service.getDraft({ type: 'posts', id: created.id }), restored);
    assert.deepEqual(await guards(f.database), []);
  } finally { await f.database.close(); }
});

test('Node draft trash: two real SQLite connections restoring the same token yield one success and one conflict', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-race-')); const path = join(directory, 'cms.sqlite');
  const f = await fixture(path); const second = openSqlite(path);
  try {
    const created = await f.service.createDraft({ type: 'posts', data: { title: 'Race', body: 'Retained' } }); await trash(f.service, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    const input = { type: 'posts', id: created.id, expected: expected(trashed) };
    const outcomes = await Promise.allSettled([f.service.restoreDraft(input), cmsService(second, editor).restoreDraft(input)]);
    assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
    const rejected = outcomes.find(outcome => outcome.status === 'rejected');
    assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof CmsError); assert.equal(rejected.reason.code, 'CONFLICT');
    const stored = await f.service.getDraft({ type: 'posts', id: created.id });
    assert.equal(stored.version, trashed.version + 1); assert.deepEqual(stored.data, created.data);
    assert.deepEqual(await guards(f.database), []);
  } finally { await second.close(); await f.database.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Node draft trash: SQL owner predicate rejects ownership changed after authorized preflight on another connection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-owner-race-')); const path = join(directory, 'cms.sqlite');
  const f = await fixture(path); const second = openSqlite(path); let raced = false;
  const interposed = { ...f.database, async atomicBatch(statements) {
    if (!raced) { raced = true; await sql`UPDATE ec_posts SET author_id = 'new-owner'`.execute(second.db); }
    return f.database.atomicBatch(statements);
  } } satisfies CmsDatabase;
  try {
    const owned = cmsService(f.database, owner); const created = await owned.createDraft({ type: 'posts', data: { title: 'Owned' } }); await trash(owned, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    await assert.rejects(() => cmsService(interposed, owner).restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) }), { code: 'CONFLICT' });
    assert.equal(raced, true);
    const stored = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    assert.equal(stored.authorId, 'new-owner'); assert.equal(stored.deletedAt, trashed.deletedAt); assert.deepEqual(expected(stored), expected(trashed));
    assert.deepEqual(await guards(f.database), []);
  } finally { await second.close(); await f.database.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Node draft trash: SQL CAS rejects restore won by another connection after preflight', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-cas-race-')); const path = join(directory, 'cms.sqlite');
  const f = await fixture(path); const second = openSqlite(path); let winner: DraftEntry | undefined;
  try {
    const created = await f.service.createDraft({ type: 'posts', data: { title: 'Race' } }); await trash(f.service, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id }); const input = { type: 'posts', id: created.id, expected: expected(trashed) };
    const interposed = { ...f.database, async atomicBatch(statements) {
      winner = await cmsService(second, editor).restoreDraft(input); return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    await assert.rejects(() => cmsService(interposed, editor).restoreDraft(input), { code: 'CONFLICT' });
    assert.ok(winner); assert.deepEqual(await f.service.getDraft({ type: 'posts', id: created.id }), winner);
    assert.deepEqual(await guards(f.database), []);
  } finally { await second.close(); await f.database.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Node draft trash: restore returns its committed row when another connection writes before batch returns', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-return-race-')); const path = join(directory, 'cms.sqlite');
  const f = await fixture(path); const second = openSqlite(path); let later: DraftEntry | undefined;
  try {
    const created = await f.service.createDraft({ type: 'posts', data: { title: 'Initial' } }); await trash(f.service, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    const interposed = { ...f.database, async atomicBatch(statements) {
      const result = await f.database.atomicBatch(statements);
      const committed = result[1].rows[0] as { version: number; updated_at: string };
      later = await cmsService(second, editor).updateDraft({ type: 'posts', id: created.id, expected: { version: committed.version, updatedAt: committed.updated_at }, data: { title: 'Later' } });
      return result;
    } } satisfies CmsDatabase;
    const first = await cmsService(interposed, editor).restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) });
    assert.equal(first.data.title, 'Initial'); assert.equal(first.version, trashed.version + 1);
    assert.equal(later?.data.title, 'Later'); assert.deepEqual(await f.service.getDraft({ type: 'posts', id: created.id }), later);
  } finally { await second.close(); await f.database.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Node draft trash: unexpected storage errors roll back restore and guard rows', async () => {
  const f = await fixture();
  try {
    const created = await f.service.createDraft({ type: 'posts', data: { title: 'Retained' } }); await trash(f.service, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    await sql`CREATE TRIGGER reject_restore BEFORE UPDATE ON ec_posts WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL
      BEGIN SELECT RAISE(ABORT, 'unexpected_restore_failure'); END`.execute(f.database.db);
    const before = await rows(f.database);
    await assert.rejects(() => f.service.restoreDraft({ type: 'posts', id: created.id, expected: expected(trashed) }), /unexpected_restore_failure/);
    assert.deepEqual(await rows(f.database), before); assert.deepEqual(await guards(f.database), []);
  } finally { await f.database.close(); }
});

test('Node draft trash: trashed data and restored revision survive real storage restart; prior token remains stale', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-restart-')); const path = join(directory, 'cms.sqlite');
  const f = await fixture(path); let database = f.database;
  try {
    const created = await f.service.createDraft({ type: 'posts', locale: 'fr', slug: 'persisted', data: { title: 'Persisted', body: 'Retained' } }); await trash(f.service, created);
    const trashed = await f.service.getTrashedDraft({ type: 'posts', id: created.id });
    await database.close(); database = openSqlite(path); await migrateCms(database);
    const reopened = cmsService(database, admin);
    assert.deepEqual(await reopened.getTrashedDraft({ type: 'posts', id: created.id }), trashed);
    const restored = await reopened.restoreDraft({ type: 'posts', id: created.id, locale: 'fr', expected: expected(trashed) });
    await database.close(); database = openSqlite(path); await migrateCms(database);
    const final = cmsService(database, admin);
    assert.deepEqual(await final.getDraft({ type: 'posts', id: created.id, locale: 'fr' }), restored);
    assert.deepEqual((await final.listTrashedDrafts({ type: 'posts' })).items, []);
    await assert.rejects(() => final.restoreDraft({ type: 'posts', id: created.id, locale: 'fr', expected: expected(trashed) }), { code: 'CONFLICT' });
    assert.deepEqual(await guards(database), []);
  } finally { await database.close(); await rm(directory, { recursive: true, force: true }); }
});
