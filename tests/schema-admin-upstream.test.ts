// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Assertion-level selected port of registry.test.ts at EmDash 1.1.0
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Vitest -> node:test,
// SchemaError -> CmsError and upstream DB fixture -> isolated SQLite/local D1.
// No portableText/datetime substitutions earn parity credit; those cases are omitted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { CmsError } from '../src/lib/server/database/contract.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: registry.test.ts:37,53,63,86,113 collection creation assertions (11)`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database); const r = new SchemaRegistry(h.database);
      const c = await r.createCollection({ slug: 'posts', label: 'Blog Posts', labelSingular: 'Post', supports: ['drafts', 'revisions'] });
      assert.equal(c.slug, 'posts'); assert.equal(c.label, 'Blog Posts'); assert.equal(c.labelSingular, 'Post');
      assert.deepEqual(c.supports, ['drafts', 'revisions']); assert.equal(c.source, 'manual'); assert.notEqual(c.id, undefined);
      assert.deepEqual((await r.createCollection({ slug: 'default_supports', label: 'Default Supports' })).supports.toSorted(), ['drafts', 'revisions'].toSorted());
      assert.deepEqual((await r.createCollection({ slug: 'no_supports', label: 'No Supports', supports: [] })).supports, []);
      const result = await sql`INSERT INTO ec_posts (id,slug,status) VALUES ('test-id','test-slug','draft')`.execute(h.database.db);
      assert.notEqual(result, undefined);
      // Source113 uses its own clean fixture. The earlier collection cases share ours;
      // selecting the same two source rows preserves its exact output assertions.
      await r.createCollection({ slug: 'pages', label: 'Pages' });
      const collections = (await r.listCollections()).filter(c => ['posts', 'pages'].includes(c.slug));
      assert.equal(collections.length, 2); assert.deepEqual(collections.map(c => c.slug), ['pages', 'posts']);
    } finally { await h.close(); }
  });
  test(`${target}: registry.test.ts:351,359,369 duplicate/reserved/slug assertions (6)`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database); const r = new SchemaRegistry(h.database);
      await r.createCollection({ slug: 'posts', label: 'Posts' });
      await assert.rejects(() => r.createCollection({ slug: 'posts', label: 'Posts 2' }), CmsError);
      for (const [slug,label] of [['content','Content'],['users','Users'],['My Posts','Posts'],['123posts','Posts'],['posts-here','Posts']]) {
        await assert.rejects(() => r.createCollection({ slug,label }), CmsError);
      }
    } finally { await h.close(); }
  });
  test(`${target}: registry.test.ts:439,610,654 string-field assertions (8)`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database); const r = new SchemaRegistry(h.database);
      await r.createCollection({ slug: 'posts', label: 'Posts' });
      const field = await r.createField('posts', { slug: 'title', label: 'Title', type: 'string', required: true });
      assert.equal(field.slug,'title'); assert.equal(field.label,'Title'); assert.equal(field.type,'string'); assert.equal(field.columnType,'TEXT'); assert.equal(field.required,true);
      await sql`INSERT INTO ec_posts (id,title) VALUES ('test-id','Test Title')`.execute(h.database.db);
      const row = (await sql<{ title: string }>`SELECT * FROM ec_posts`.execute(h.database.db)).rows[0]; assert.equal(row.title, 'Test Title');
      await r.createField('posts', { slug: 'other_title', label: 'Title', type: 'string', validation: { minLength: 1, maxLength: 100 } });
      const read = await r.getField('posts','other_title'); assert.notEqual(read,null); assert.deepEqual(read?.validation,{ minLength:1,maxLength:100 });
    } finally { await h.close(); }
  });
}
