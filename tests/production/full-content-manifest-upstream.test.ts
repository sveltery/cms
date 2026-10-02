// Adapted assertions from EmDash 1.1.0 immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: unit/runtime/manifest-build.test.ts
// declarations 257/386/406, blob 91f8fddb1472831b984034daa9776edd31d98e07.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Full runtime generation becomes the registered Kit editing-manifest query.
// Raw disposable metadata setup is an explicit fixture substitution; no schema
// migration, config collection, plugin or whole runtime manifest credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { fullContentFixture } from '../helpers/full-content-fixture.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: manifest-build.test.ts:386 includes field definitions built via the two-query JOIN`, async () => {
    const h = await fullContentFixture(target);
    try {
      await sql`UPDATE _cms_fields SET type = 'json' WHERE slug = 'body'`.execute(h.database.db);
      const manifest = await h.query('getEditorManifest');
      const posts = manifest.collections.posts;
      assert.notEqual(posts, undefined);
      assert.equal(posts?.fields.title?.kind, 'string');
      assert.equal(posts?.fields.body?.kind, 'json');
    } finally { await h.close(); }
  });

  test(`${target}: manifest-build.test.ts:406 forwards declared validation on every field type`, async () => {
    const h = await fullContentFixture(target);
    try {
      await sql`UPDATE _cms_fields SET validation = ${JSON.stringify({ minLength: 3, maxLength: 80 })} WHERE slug = 'title'`.execute(h.database.db);
      await sql`UPDATE _cms_fields SET type = 'text', validation = ${JSON.stringify({ maxLength: 160 })} WHERE slug = 'excerpt'`.execute(h.database.db);
      await sql`UPDATE _cms_fields SET type = 'integer' WHERE slug = 'reading_minutes'`.execute(h.database.db);
      const collection = await h.registry.getCollection('posts'); assert.ok(collection);
      await sql`INSERT INTO _cms_fields(id,collection_id,slug,label,type,column_type,required,"unique",sort_order,created_at)
        VALUES ('source-subtitle',${collection.id},'subtitle','Subtitle','string','TEXT',0,0,20,${new Date().toISOString()})`.execute(h.database.db);
      const fields = (await h.query('getEditorManifest')).collections.posts?.fields;
      assert.deepEqual(fields?.title?.validation, { minLength: 3, maxLength: 80 });
      assert.deepEqual(fields?.excerpt?.validation, { maxLength: 160 });
      assert.deepEqual(fields?.reading_minutes?.validation, { min: 1, max: 60 });
      assert.equal(fields?.subtitle?.validation, undefined);
    } finally { await h.close(); }
  });

  test(`${target}: manifest-build.test.ts:257 marks unknown database field types as unsupported`, async () => {
    const h = await fullContentFixture(target);
    try {
      const collection = await h.registry.createCollection({ slug: 'imports', label: 'Imports', labelSingular: 'Import' });
      await sql`INSERT INTO _cms_fields(id,collection_id,slug,label,type,column_type,required,"unique",sort_order,created_at)
        VALUES ('field_unknown_type',${collection.id},'payload','Payload','unknown_plugin_type','TEXT',0,0,0,${new Date().toISOString()})`.execute(h.database.db);
      const field = (await h.query('getEditorManifest')).collections.imports?.fields.payload;
      assert.ok(field);
      assert.equal(field.kind, 'unsupported');
      assert.equal(field.label, 'Payload');
      assert.deepEqual(field.unsupportedType, { type: 'unknown_plugin_type', path: 'type' });
    } finally { await h.close(); }
  });
}
