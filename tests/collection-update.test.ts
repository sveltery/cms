import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import type { CmsDatabase, Collection } from '../src/lib/server/database/contract.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';

const admin: ServerPrincipal = { id: 'server-admin', permissions: ['schema:manage', 'schema:read'] };
const expected = (value: Collection) => ({ version: value.version, updatedAt: value.updatedAt });
const objects = async (database: CmsDatabase) =>
  (await sql`SELECT name, sql FROM sqlite_master WHERE name != '_cf_METADATA' ORDER BY name`.execute(database.db)).rows;
const snapshot = async (database: CmsDatabase) => ({
  objects: await objects(database),
  collections: await database.db.selectFrom('_cms_collections').selectAll().orderBy('id').execute(),
  fields: await database.db.selectFrom('_cms_fields').selectAll().orderBy('id').execute(),
  guards: await database.db.selectFrom('_cms_guards').selectAll().execute()
});

test('collection update: permission precedes hostile input and every storage access', async () => {
  let touched = 0;
  const database = new Proxy({} as CmsDatabase, { get() { touched++; throw new Error('storage accessed'); } });
  const hostile = Object.defineProperty({}, 'collection', { get() { throw new Error('input accessed'); }, enumerable: true });
  for (const [principal, code] of [[null, 'UNAUTHENTICATED'],
    [{ id: 'reader', permissions: ['schema:read'] }, 'FORBIDDEN'],
    [{ id: 'writer', permissions: ['content:edit_any'] }, 'FORBIDDEN']] as const) {
    await assert.rejects(() => cmsService(database, principal).updateCollection(hostile), { code });
  }
  assert.equal(touched, 0);
});

for (const target of ['Node', 'D1'] as const) {
  async function fixture() {
    const storage = await collectionUpdateStorage(target);
    await migrateCms(storage.database);
    const registry = new SchemaRegistry(storage.database);
    const definition = await registry.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post', description: 'Description' });
    return { ...storage, registry, definition, service: cmsService(storage.database, admin) };
  }
  test(`${target}: metadata partial updates preserve omissions, undefined and explicit [] without schema DDL/version changes`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await f.registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
      const before = await f.registry.getCollectionWithFields('posts'); assert.ok(before);
      const schema = await objects(f.database);
      const updated = await f.service.updateCollection({ collection: 'posts', expected: expected(before),
        input: { labelSingular: 'Article', description: '', supports: [] } });
      assert.equal(updated.label, 'Posts'); assert.equal(updated.labelSingular, 'Article');
      assert.equal(updated.description, ''); assert.deepEqual(updated.supports, []);
      assert.equal(updated.version, before.version); assert.equal(updated.id, before.id);
      assert.equal(updated.createdAt, before.createdAt); assert.equal(updated.slug, before.slug);
      const relabeled = await f.service.updateCollection({ collection: 'posts', expected: expected(updated),
        input: { label: 'Articles', labelSingular: undefined, description: undefined, supports: undefined } });
      assert.equal(relabeled.label, 'Articles'); assert.equal(relabeled.labelSingular, 'Article');
      assert.equal(relabeled.description, ''); assert.deepEqual(relabeled.supports, []);
      assert.equal(relabeled.version, before.version);
      assert.deepEqual((await f.registry.getCollectionWithFields('posts'))?.fields, before.fields);
      assert.deepEqual(await objects(f.database), schema);
      assert.deepEqual(await f.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
    } finally { await f.close(); }
  });
  test(`${target}: strict bounded metadata/preconditions reject before storage and preserve every row`, { timeout: 30000 }, async () => {
    const f = await fixture(); let touched = 0;
    const guarded = new Proxy(f.database, { get(target, key, receiver) {
      if (key === 'db' || key === 'atomicBatch') touched++;
      return Reflect.get(target, key, receiver);
    } });
    const service = cmsService(guarded, admin);
    try {
      const before = await snapshot(f.database);
      for (const input of [{ slug: 'changed' }, { source: 'seed' }, { version: 99 }, { routable: true },
        { label: '' }, { label: ' '.repeat(5) }, { label: 'x'.repeat(201) }, { labelSingular: null },
        { description: null }, { description: 'x'.repeat(2001) }, { supports: ['search'] },
        { supports: ['drafts', 'drafts', 'drafts'] }, { supports: null }, { authorId: 'forged' }, []]) {
        await assert.rejects(() => service.updateCollection({ collection: 'posts', input, expected: expected(f.definition) }), { code: 'VALIDATION_ERROR' });
      }
      for (const value of [undefined, 1, { version: 1 }, { version: 0, updatedAt: f.definition.updatedAt },
        { version: 1, updatedAt: 'invalid' }, { ...expected(f.definition), extra: true }]) {
        await assert.rejects(() => service.updateCollection({ collection: 'posts', input: {}, expected: value }), { code: 'VALIDATION_ERROR' });
      }
      await assert.rejects(() => service.updateCollection({ collection: '../posts', input: {}, expected: expected(f.definition) }), { code: 'VALIDATION_ERROR' });
      assert.equal(touched, 0);
      assert.deepEqual(await snapshot(f.database), before);
    } finally { await f.close(); }
  });
  test(`${target}: empty updates strictly advance timestamp even with a frozen clock and stale CAS never writes`, { timeout: 30000 }, async t => {
    const f = await fixture();
    try {
      t.mock.timers.enable({ apis: ['Date'], now: new Date(f.definition.updatedAt).getTime() });
      const updated = await f.service.updateCollection({ collection: 'posts', input: {}, expected: expected(f.definition) });
      assert.equal(updated.version, f.definition.version);
      assert.equal(new Date(updated.updatedAt).getTime(), new Date(f.definition.updatedAt).getTime() + 1);
      const before = await snapshot(f.database);
      await assert.rejects(() => f.service.updateCollection({ collection: 'posts', input: { label: 'Stale' }, expected: expected(f.definition) }), { code: 'CONFLICT' });
      assert.deepEqual(await snapshot(f.database), before);
      const twice = await f.service.updateCollection({ collection: 'posts', input: {}, expected: expected(updated) });
      assert.equal(new Date(twice.updatedAt).getTime(), new Date(updated.updatedAt).getTime() + 1);
    } finally { t.mock.timers.reset(); await f.close(); }
  });
  test(`${target}: changed schema version conflicts and missing collections report NOT_FOUND without writes`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await f.registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
      const before = await snapshot(f.database);
      await assert.rejects(() => f.service.updateCollection({ collection: 'posts', input: { label: 'Stale' }, expected: expected(f.definition) }), { code: 'CONFLICT' });
      await assert.rejects(() => f.service.updateCollection({ collection: 'missing', input: {}, expected: expected(f.definition) }), { code: 'NOT_FOUND' });
      assert.deepEqual(await snapshot(f.database), before);
    } finally { await f.close(); }
  });
  test(`${target}: race between preflight and actual SQL cannot overwrite another metadata update`, { timeout: 30000 }, async () => {
    const f = await fixture(); let raced = false; let winner: Collection | undefined;
    const racing = { ...f.database, async atomicBatch(statements) {
      if (!raced) {
        raced = true;
        winner = await f.service.updateCollection({ collection: 'posts', input: { label: 'Winner' }, expected: expected(f.definition) });
      }
      return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    try {
      await assert.rejects(() => cmsService(racing, admin).updateCollection({ collection: 'posts', input: { label: 'Loser' }, expected: expected(f.definition) }), { code: 'CONFLICT' });
      assert.equal(raced, true); assert.ok(winner);
      assert.deepEqual(await f.registry.getCollection('posts'), winner);
      assert.deepEqual(await f.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
    } finally { await f.close(); }
  });
  test(`${target}: unexpected storage failures retain their error and roll back metadata`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await sql`CREATE TRIGGER reject_metadata BEFORE UPDATE ON _cms_collections BEGIN SELECT RAISE(ABORT, 'unexpected_metadata_failure'); END`.execute(f.database.db);
      const before = await snapshot(f.database);
      await assert.rejects(() => f.service.updateCollection({ collection: 'posts', input: { label: 'Rejected' }, expected: expected(f.definition) }), /unexpected_metadata_failure/);
      assert.deepEqual(await snapshot(f.database), before);
    } finally { await f.close(); }
  });
  test(`${target}: update returns its own committed row when another writer commits before the adapter returns`, { timeout: 30000 }, async () => {
    const f = await fixture(); let later: Collection | undefined;
    const delayed = { ...f.database, async atomicBatch(statements) {
      const results = await f.database.atomicBatch(statements);
      const committed = results[1].rows[0] as { version: number; updated_at: string };
      later = await f.service.updateCollection({ collection: 'posts', input: { label: 'Later' },
        expected: { version: committed.version, updatedAt: committed.updated_at } });
      return results;
    } } satisfies CmsDatabase;
    try {
      const first = await cmsService(delayed, admin).updateCollection({ collection: 'posts', input: { label: 'First' }, expected: expected(f.definition) });
      assert.equal(first.label, 'First'); assert.equal(later?.label, 'Later');
      assert.deepEqual(await f.registry.getCollection('posts'), later);
    } finally { await f.close(); }
  });
  test(`${target}: metadata survives storage/runtime restart and prior timestamp stays stale`, { timeout: 30000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-collection-update-'));
    let storage = await collectionUpdateStorage(target, directory);
    try {
      await migrateCms(storage.database);
      const service = cmsService(storage.database, admin);
      const initial = await service.createCollection({ slug: 'posts', label: 'Posts' });
      const updated = await service.updateCollection({ collection: 'posts', input: { label: 'Persisted', labelSingular: 'Post', description: 'Saved', supports: [] }, expected: expected(initial) });
      await storage.close(); storage = await collectionUpdateStorage(target, directory);
      await migrateCms(storage.database);
      const reopened = cmsService(storage.database, admin);
      assert.deepEqual(await reopened.getCollection('posts'), { ...updated, fields: [] });
      const before = await snapshot(storage.database);
      await assert.rejects(() => reopened.updateCollection({ collection: 'posts', input: {}, expected: expected(initial) }), { code: 'CONFLICT' });
      assert.deepEqual(await snapshot(storage.database), before);
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });
}
