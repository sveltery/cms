// The source output case preserves EmDash 1.1.0 manifest-build.test.ts:537/556/564.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Query counts, limits, order, failure and disclosure cases are supplemental.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql, type CompiledQuery, type KyselyPlugin } from 'kysely';
import { Miniflare } from 'miniflare';
import { build } from 'vite';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry, MAX_FIELDS } from '../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { editorManifest, type EditorManifest } from '../src/lib/server/content/manifest.ts';

const author = { id: 'author', permissions: ['content:read', 'content:read_drafts'] as const };
async function fixture(target: 'Node' | 'D1') {
  const runtime = target === 'D1' ? new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("manifest fixture"); } }',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { DB: 'cms-manifest-batching' } }) : undefined;
  const database = runtime ? openD1(await runtime.getD1Database('DB')) : openSqlite(':memory:');
  await migrateCms(database);
  const queries: CompiledQuery[] = [];
  const compiled = new WeakMap<object, CompiledQuery>();
  const plugin: KyselyPlugin = {
    transformQuery(args) { compiled.set(args.queryId, database.db.getExecutor().compileQuery(args.node, args.queryId)); return args.node; },
    async transformResult(args) { queries.push(compiled.get(args.queryId)!); return args.result; }
  };
  const observed = { ...database, db: database.db.withPlugin(plugin) };
  return { database, observed, queries, async close() { await database.close(); await runtime?.dispose(); } };
}

// Trusted raw fixture seeds metadata only, avoiding unrelated physical-table DDL.
// IDs oppose slug order; fields tie sort_order while created_at opposes ID order.
async function seed(database: CmsDatabase, count: number, fields = 1) {
  for (let index = 0; index < count; index++) {
    const slug = `coll_${String(index).padStart(3, '0')}`;
    const id = `collection_${String(count - index).padStart(3, '0')}`;
    await database.db.insertInto('_cms_collections').values({ id, slug, label: `Coll ${index}`,
      label_singular: index % 2 ? '' : null, description: 'Private description', supports: '["drafts"]',
      source: 'manual', version: 1, created_at: '2020-01-01', updated_at: '2020-01-01' }).execute();
    for (let field = fields - 1; field >= 0; field--) {
      await database.db.insertInto('_cms_fields').values({
        id: `${id}_field_${String(field).padStart(3, '0')}`, collection_id: id,
        slug: `field_${String(field).padStart(3, '0')}`, label: `Field ${field}`,
        type: field % 2 ? 'text' : 'string', column_type: 'TEXT', required: field % 2,
        unique: 0, default_value: '"Private default"', validation: field % 2
          ? '{"minLength":1,"maxLength":80,"privateNote":"Private validation"}' : null,
        sort_order: Math.floor(field / 2), created_at: `2020-${String(fields - field).padStart(3, '0')}`
      }).execute();
    }
  }
}

// Executable pre-change projection oracle through unchanged registry methods.
async function previousProjection(database: CmsDatabase): Promise<EditorManifest> {
  const registry = new SchemaRegistry(database);
  const collections: EditorManifest['collections'] = {};
  for (const collection of await registry.listCollections()) {
    if (Object.hasOwn(Object.prototype, collection.slug)) continue;
    const fields: EditorManifest['collections'][string]['fields'] = {};
    for (const field of await registry.listFields(collection.id)) {
      fields[field.slug] = { id: field.id, kind: field.type === 'text' ? 'richText' : 'string',
        label: field.label, required: field.required, ...(field.validation ? { validation: {
          ...(field.validation.minLength === undefined ? {} : { minLength: field.validation.minLength }),
          ...(field.validation.maxLength === undefined ? {} : { maxLength: field.validation.maxLength })
        } } : {}) };
    }
    collections[collection.slug] = { label: collection.label,
      labelSingular: collection.labelSingular || collection.label, supports: [...collection.supports], fields };
  }
  return { collections };
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target} source: five collection output, manifest-build.test.ts:537`, { timeout: 30000 }, async () => {
    const local = await fixture(target); const registry = new SchemaRegistry(local.database);
    try {
      for (let i = 0; i < 5; i++) {
        await registry.createCollection({ slug: `coll_${i}`, label: `Coll ${i}`, labelSingular: `Coll ${i}` });
        await registry.createField(`coll_${i}`, { slug: 'title', label: 'Title', type: 'string' });
      }
      const manifest = await editorManifest(local.observed, author);
      assert.deepEqual(Object.keys(manifest.collections).toSorted(), ['coll_0', 'coll_1', 'coll_2', 'coll_3', 'coll_4']);
      for (let i = 0; i < 5; i++) assert.equal(manifest.collections[`coll_${i}`]?.fields.title?.kind, 'string');
    } finally { await local.close(); }
  });

  test(`${target} supplemental: 0/1/50/51/100 boundaries preserve ordered projection with bounded reads`, { timeout: 60000 }, async () => {
    const local = await fixture(target);
    try {
      for (const count of [0, 1, 50, 51, 100]) {
        await local.database.db.deleteFrom('_cms_fields').execute();
        await local.database.db.deleteFrom('_cms_collections').execute();
        await seed(local.database, count, 2);
        if (count === 100) {
          // Corrupt metadata beyond the collection cap must remain unread/unparsed.
          await local.database.db.insertInto('_cms_collections').values({ id: 'omitted', slug: 'zzz_omitted',
            label: 'Omitted', label_singular: null, description: null, supports: 'malformed',
            source: 'manual', version: 1, created_at: '2020-01-01', updated_at: '2020-01-01' }).execute();
          await local.database.db.insertInto('_cms_fields').values({ id: 'omitted_field', collection_id: 'omitted',
            slug: 'title', label: 'Title', type: 'string', column_type: 'TEXT', required: 0, unique: 0,
            default_value: 'malformed', validation: 'malformed', sort_order: 0, created_at: '2020-01-01' }).execute();
        }
        local.queries.length = 0;
        const manifest = await editorManifest(local.observed, author);
        assert.equal(local.queries.length, 1 + Math.ceil(count / 50));
        assert.ok(local.queries.every(query => /^select/i.test(query.sql)));
        const fieldQueries = local.queries.slice(1);
        assert.ok(fieldQueries.every(query => /"collection_id" in \(/.test(query.sql)));
        assert.ok(fieldQueries.every(query => query.parameters.length <= 51));
        assert.deepEqual(manifest, await previousProjection(local.database));
        assert.equal(JSON.stringify(manifest), JSON.stringify(await previousProjection(local.database)));
        assert.equal(Object.keys(manifest.collections).length, count);
        assert.doesNotMatch(JSON.stringify(manifest), /Private|default_value|sort_order|collection_id|field_rank/);
      }
    } finally { await local.close(); }
  });

  test(`${target} supplemental: each collection retains its 32-field cap, including ignored malformed rows`, { timeout: 30000 }, async () => {
    const local = await fixture(target);
    try {
      await seed(local.database, 2, MAX_FIELDS + 2);
      await sql`UPDATE _cms_fields SET validation = 'malformed', default_value = 'malformed' WHERE sort_order >= ${MAX_FIELDS / 2}`.execute(local.database.db);
      const manifest = await editorManifest(local.observed, author);
      assert.equal(local.queries.length, 2);
      for (const collection of Object.values(manifest.collections)) assert.equal(Object.keys(collection.fields).length, MAX_FIELDS);
      assert.equal(JSON.stringify(manifest), JSON.stringify(await previousProjection(local.database)));
      await local.database.db.updateTable('_cms_fields').set({ validation: 'malformed' }).where('slug', '=', 'field_000').execute();
      await assert.rejects(() => editorManifest(local.observed, author), SyntaxError);
      await assert.rejects(() => previousProjection(local.database), SyntaxError);
      await local.database.db.updateTable('_cms_fields').set({ validation: null, default_value: 'malformed' }).where('slug', '=', 'field_000').execute();
      await assert.rejects(() => editorManifest(local.observed, author), SyntaxError);
      await assert.rejects(() => previousProjection(local.database), SyntaxError);
    } finally { await local.close(); }
  });

  test(`${target} supplemental: authorization precedes SQL; constructor fields remain unparsed; errors propagate`, { timeout: 30000 }, async () => {
    const local = await fixture(target);
    try {
      for (const [principal, code] of [
        [null, 'UNAUTHENTICATED'], [{ id: '', permissions: [] }, 'UNAUTHENTICATED'],
        [{ id: 'x'.repeat(129), permissions: [] }, 'UNAUTHENTICATED'],
        [{ id: 'subscriber', permissions: ['content:read'] }, 'FORBIDDEN'],
        [{ id: 'partial', permissions: ['content:read_drafts'] }, 'FORBIDDEN']
      ] as const) await assert.rejects(() => editorManifest(local.observed, principal), { code });
      assert.equal(local.queries.length, 0);
      await seed(local.database, 1);
      await local.database.db.updateTable('_cms_collections').set({ slug: 'constructor' }).execute();
      await local.database.db.updateTable('_cms_fields').set({ validation: 'malformed', default_value: 'malformed' }).execute();
      assert.deepEqual(await editorManifest(local.observed, author), { collections: {} });
      assert.equal(JSON.stringify(await editorManifest(local.observed, author)), JSON.stringify(await previousProjection(local.database)));
      await local.database.db.schema.dropTable('_cms_fields').execute();
      assert.deepEqual(await editorManifest(local.observed, author), { collections: {} });
      await local.database.db.updateTable('_cms_collections').set({ slug: 'posts' }).execute();
      await assert.rejects(() => editorManifest(local.observed, author), /_cms_fields/);
      await local.database.db.schema.dropTable('_cms_collections').execute();
      await assert.rejects(() => editorManifest(local.observed, author), /_cms_collections/);
    } finally { await local.close(); }
  });

  test(`${target} supplemental: uncached collection and field changes appear on the next read`, { timeout: 30000 }, async () => {
    const local = await fixture(target);
    try {
      await seed(local.database, 1);
      assert.equal((await editorManifest(local.observed, author)).collections.coll_000.fields.field_000.label, 'Field 0');
      await local.database.db.updateTable('_cms_fields').set({ label: 'Updated field', required: 1 }).execute();
      await local.database.db.updateTable('_cms_collections').set({ label: 'Updated collection' }).execute();
      local.queries.length = 0;
      const manifest = await editorManifest(local.observed, author);
      assert.equal(manifest.collections.coll_000.label, 'Updated collection');
      assert.equal(manifest.collections.coll_000.fields.field_000.label, 'Updated field');
      assert.equal(manifest.collections.coll_000.fields.field_000.required, true);
      assert.equal(local.queries.length, 2);
      assert.equal(JSON.stringify(manifest), JSON.stringify(await previousProjection(local.database)));
      await local.database.db.deleteFrom('_cms_fields').execute();
      assert.deepEqual((await editorManifest(local.observed, author)).collections.coll_000.fields, {});
    } finally { await local.close(); }
  });
}

test('workerd supplemental: manifest executes on the actual local D1 binding without nodejs_compat', { timeout: 30000 }, async () => {
  const built = await build({ configFile: false, logLevel: 'error', build: { target: 'es2022', minify: false, write: false,
    lib: { entry: new URL('./helpers/editor-manifest-worker.ts', import.meta.url).pathname, formats: ['es'], fileName: 'editor-manifest-worker' } } });
  assert.ok(!('on' in built));
  const chunks = (Array.isArray(built) ? built : [built]).flatMap(output => output.output).filter(output => output.type === 'chunk');
  assert.equal(chunks.length, 1); assert.doesNotMatch(chunks[0].code, /node:sqlite/);
  const runtime = new Miniflare({ modules: true, script: chunks[0].code, compatibilityDate: '2026-05-07',
    host: '127.0.0.1', port: 0, cf: false, d1Databases: { DB: 'cms-manifest-worker' } });
  try {
    const response = await runtime.dispatchFetch('https://cms.example/'); assert.equal(response.status, 200);
    const result = await response.json() as { manifest: EditorManifest; forbidden: string; unauthenticated: string };
    assert.equal(result.forbidden, 'FORBIDDEN'); assert.equal(result.unauthenticated, 'UNAUTHENTICATED');
    assert.deepEqual(Object.keys(result.manifest.collections), ['posts']);
    assert.deepEqual(result.manifest.collections.posts, { label: 'Posts', labelSingular: 'Post',
      supports: ['drafts', 'revisions'], fields: { title: {
        id: result.manifest.collections.posts.fields.title.id, kind: 'string', label: 'Title', required: true,
        validation: { maxLength: 80 }
      } } });
    assert.doesNotMatch(JSON.stringify(result), /Private|description|default_value|field_rank/);
  } finally { await runtime.dispose(); }
});
