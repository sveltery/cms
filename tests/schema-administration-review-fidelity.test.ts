import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

// Original raw-field fidelity/native snapshot regressions; no copied-source credit.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: a projected fallback string cannot authorize an unsupported raw title alias`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database); const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'posts', label: 'Posts' });
      await registry.createField('posts', { slug: 'future', label: 'Future', type: 'string' });
      await h.database.db.updateTable('_cms_fields').set({ type: 'future_field_type' }).where('slug', '=', 'future').execute();
      const projected = (await registry.getField('posts', 'future'))!;
      assert.equal(projected.type, 'string'); assert.equal(projected.unsupportedType?.type, 'future_field_type');
      const before = await registry.getCollection('posts');
      await assert.rejects(() => registry.updateCollection('posts', { titleField: 'future' }), { code: 'INVALID_TITLE_FIELD' });
      assert.deepEqual(await registry.getCollection('posts'), before);
      assert.equal((await h.database.db.selectFrom('_cms_guards').selectAll().execute()).length, 0);
    } finally { await h.close(); }
  });
  test(`${target}: duplicate native snapshots cannot omit another collection's changed revision`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database); const registry = new SchemaRegistry(h.database);
      for (const slug of ['first', 'second', 'third']) await registry.createCollection({ slug, label: slug });
      const service = cmsService(h.database, { id: 'admin', permissions: ['schema:read', 'schema:manage'] });
      const initial = await service.listCollections();
      const snapshot = ({ slug, version, updatedAt }: typeof initial[number]) => ({ slug, version, updatedAt });
      await registry.updateCollection('second', { label: 'Changed second' });
      const before = await service.listCollections();
      await assert.rejects(() => service.reorderCollections({ slugs: ['second', 'first'], expected: [snapshot(initial[0]), snapshot(initial[0]), snapshot(initial[2])] }), { code: 'CONFLICT' });
      for (const expected of [initial.slice(0, 2).map(snapshot), initial.map(snapshot), before.map(snapshot).map(value => value.slug === 'second' ? { ...value, version: value.version + 1 } : value)]) {
        await assert.rejects(() => service.reorderCollections({ slugs: ['second', 'first'], expected }), { code: 'CONFLICT' });
        assert.deepEqual(await service.listCollections(), before);
      }
      assert.equal((await h.database.db.selectFrom('_cms_guards').selectAll().execute()).length, 0);
      await service.reorderCollections({ slugs: ['first'], expected: before.map(snapshot).reverse() });
      const after = await service.listCollections();
      assert.equal(after.find(collection => collection.slug === 'first')!.sortOrder, 0);
      assert.ok(after.filter(collection => collection.slug !== 'first').every(collection => collection.sortOrder === undefined), 'source partial collection-order behavior remains accepted');
    } finally { await h.close(); }
  });
}
