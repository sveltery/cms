import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

// Supplemental public-boundary regressions, not copied upstream declarations.
// SEO and collection timestamp expectations were reproduced with immutable
// registry.ts blob da7bbcdda224dfca8d9146b2f36659ab90bcac2e at pin 913cb1bb.
// Strict recursive JSON is a local input adaptation, not source codec fidelity.
const principal = { id: 'owner', permissions: ['schema:manage', 'content:create', 'content:read', 'content:read_drafts', 'content:edit_any'] } as const;
const old = '2000-01-01T00:00:00.000Z';
async function fixture(target: 'Node' | 'D1') {
  const h = await schemaAdminStorage(target); await migrateCms(h.database);
  return { ...h, registry: new SchemaRegistry(h.database), service: cmsService(h.database, principal) };
}
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: create derives SEO support unless explicitly overridden`, async () => {
    const h = await fixture(target);
    try {
      assert.equal((await h.registry.createCollection({ slug: 'derived', label: 'Derived', supports: ['seo'] })).hasSeo, true);
      assert.equal((await h.registry.createCollection({ slug: 'off', label: 'Off', supports: ['seo'], hasSeo: false })).hasSeo, false);
      assert.equal((await h.registry.createCollection({ slug: 'on', label: 'On', supports: [], hasSeo: true })).hasSeo, true);
      assert.equal((await h.registry.createCollection({ slug: 'defaulted', label: 'Defaulted' })).hasSeo, false);
    } finally { await h.close(); }
  });
  test(`${target}: update derives supplied SEO support while preserving explicit and omitted values`, async () => {
    const h = await fixture(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      assert.equal((await h.registry.updateCollection('posts', { supports: ['seo'] })).hasSeo, true);
      assert.equal((await h.registry.updateCollection('posts', { label: 'New label' })).hasSeo, true);
      assert.equal((await h.registry.updateCollection('posts', { supports: [] })).hasSeo, false);
      assert.equal((await h.registry.updateCollection('posts', { supports: ['seo'], hasSeo: false })).hasSeo, false);
      assert.equal((await h.registry.updateCollection('posts', { supports: [], hasSeo: true })).hasSeo, true);
    } finally { await h.close(); }
  });
  test(`${target}: collection reorder touches listed and cleared timestamps without a version bump and rejects stale CAS`, async () => {
    const h = await fixture(target);
    try {
      for (const slug of ['first', 'second', 'tail']) await h.registry.createCollection({ slug, label: slug, sortOrder: 42 });
      await h.database.db.updateTable('_cms_collections').set({ updated_at: old }).execute();
      const before = (await h.registry.listCollections()).map(item => ({ slug: item.slug, version: item.version, updatedAt: item.updatedAt }));
      await h.registry.reorderCollections(['second', 'first']);
      const after = await h.registry.listCollections();
      assert.deepEqual(after.map(item => item.slug), ['second', 'first', 'tail']);
      assert.deepEqual(after.map(item => item.sortOrder), [0, 1, undefined]);
      for (const item of after) {
        assert.notEqual(item.updatedAt, old);
        assert.equal(item.version, before.find(previous => previous.slug === item.slug)!.version);
      }
      for (const stale of before) await assert.rejects(() => h.service.updateCollection({ collection: stale.slug, input: { sortOrder: 42 }, expected: { version: stale.version, updatedAt: stale.updatedAt } }), { code: 'CONFLICT' });
      assert.deepEqual(await h.registry.listCollections(), after);
    } finally { await h.close(); }
  });
  for (const [pointer, type] of [['titleField', 'string'], ['dateField', 'datetime']] as const) {
    test(`${target}: deleting ${pointer} clears its pointer and touches only that collection timestamp without a version bump`, async () => {
      const h = await fixture(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        await h.registry.createCollection({ slug: 'other', label: 'Other' });
        await h.registry.createField('posts', { slug: 'value', label: 'Value', type });
        await h.registry.updateCollection('posts', { [pointer]: 'value' });
        await h.database.db.updateTable('_cms_collections').set({ updated_at: old }).execute();
        const before = (await h.registry.getCollection('posts'))!;
        await h.registry.deleteField('posts', 'value');
        const after = (await h.registry.getCollection('posts'))!;
        assert.equal(after[pointer], undefined); assert.notEqual(after.updatedAt, old); assert.equal(after.version, before.version);
        assert.equal((await h.registry.getCollection('other'))!.updatedAt, old);
        await assert.rejects(() => h.service.updateCollection({ collection: 'posts', input: { label: 'Stale' }, expected: { version: before.version, updatedAt: before.updatedAt } }), { code: 'CONFLICT' });
      } finally { await h.close(); }
    });
  }
  test(`${target}: deleting an unreferenced field leaves collection metadata timestamps intact`, async () => {
    const h = await fixture(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      await h.registry.createField('posts', { slug: 'value', label: 'Value', type: 'string' });
      await h.database.db.updateTable('_cms_collections').set({ updated_at: old }).execute();
      const before = await h.registry.getCollection('posts');
      await h.registry.deleteField('posts', 'value');
      assert.deepEqual(await h.registry.getCollection('posts'), before);
    } finally { await h.close(); }
  });
  test(`${target}: actual create and partial update reject nested lossy JSON with zero persisted changes`, async () => {
    const h = await fixture(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      await h.registry.createField('posts', { slug: 'value_json', label: 'Value', type: 'json' });
      const shared = { constructor: 'own key', prototype: null, nested: [true, false, 0, 1.5, '\0', null, { valid: 'yes' }] };
      const created = await h.service.createDraft({ type: 'posts', data: { value_json: { left: shared, right: shared } } });
      assert.deepEqual(created.data.value_json, { left: shared, right: shared });
      const before = (await sql`SELECT * FROM ec_posts ORDER BY id`.execute(h.database.db)).rows;
      const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
      const invalid = [
        { nested: undefined }, { nested: () => undefined }, { nested: Symbol('value') },
        { nested: NaN }, { nested: Infinity }, { nested: -Infinity },
        { nested: new Date(old) }, { nested: new Map([['key', 'value']]) }, { nested: new Set(['value']) },
        { nested: new Array(1) }, { nested: 1n }, cyclic
      ];
      for (const value of invalid) {
        await assert.rejects(() => h.service.createDraft({ type: 'posts', data: { value_json: value } }), { code: 'VALIDATION_ERROR' });
        await assert.rejects(() => h.service.updateDraft({ type: 'posts', id: created.id, expected: { version: created.version, updatedAt: created.updatedAt }, data: { value_json: value } }), { code: 'VALIDATION_ERROR' });
        assert.deepEqual((await sql`SELECT * FROM ec_posts ORDER BY id`.execute(h.database.db)).rows, before);
      }
    } finally { await h.close(); }
  });
}
