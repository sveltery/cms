import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

// Original adapter/native CAS regressions, with zero copied source credit.
async function fixture(target: 'Node' | 'D1', count: number) {
  const h = await schemaAdminStorage(target);
  await migrateCms(h.database);
  const registry = new SchemaRegistry(h.database);
  for (let i = 0; i < count; i++) await registry.createCollection({ slug: `posts_${i}`, label: `Posts ${i}` });
  const service = cmsService(h.database, { id: 'admin', permissions: ['schema:manage', 'schema:read'] });
  const initial = await service.listCollections();
  const expected = initial.map(({ slug, version, updatedAt }) => ({ slug, version, updatedAt }));
  return { ...h, registry, service, initial, expected };
}

for (const target of ['Node', 'D1'] as const) {
  for (const count of [34, 100]) test(`${target}: native reorder fits adapter bindings for ${count} collections`, async () => {
    const h = await fixture(target, count);
    try {
      const slugs = h.initial.map(collection => collection.slug).reverse();
      let error: unknown;
      try { await h.service.reorderCollections({ slugs, expected: h.expected }); } catch (cause) { error = cause; }
      assert.equal(error, undefined, 'supported collection orders fit the adapter statement limit');
      const after = await h.service.listCollections();
      assert.deepEqual(after.map(collection => collection.slug), slugs);
      assert.ok(after.every(collection => collection.updatedAt > h.initial.find(before => before.slug === collection.slug)!.updatedAt));
      assert.equal((await h.database.db.selectFrom('_cms_guards').selectAll().execute()).length, 0);
    } finally { await h.close(); }
  });
  for (const position of ['middle', 'last'] as const) test(`${target}: invalid ${position} snapshot atomically rolls back a 100-collection reorder`, async () => {
    const h = await fixture(target, 100);
    try {
      const victim = h.initial[position === 'middle' ? 50 : 99];
      const original = h.database.atomicBatch.bind(h.database);
      let concurrent: typeof h.initial | undefined;
      h.database.atomicBatch = async statements => {
        h.database.atomicBatch = original;
        await h.database.db.updateTable('_cms_collections').set({ updated_at: '2999-01-01T00:00:00.000Z' }).where('slug', '=', victim.slug).execute();
        concurrent = await h.service.listCollections();
        return original(statements);
      };
      await assert.rejects(() => h.service.reorderCollections({ slugs: h.initial.map(collection => collection.slug).reverse(), expected: h.expected }), { code: 'CONFLICT' });
      assert.ok(concurrent);
      assert.deepEqual(await h.service.listCollections(), concurrent, 'no earlier order or metadata writes survive a late CAS guard');
      assert.equal((await h.database.db.selectFrom('_cms_guards').selectAll().execute()).length, 0, 'guard inserts roll back with the failed batch');
    } finally { await h.close(); }
  });
}
