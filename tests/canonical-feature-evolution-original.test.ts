// Whole Original ordinary installation assertions; zero copied Source credit.
// No auth/session or concurrent relation-binding probe is introduced here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { historicalFeatureStorage } from './helpers/canonical-feature-storage-original.ts';

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${mode}: actual existing and newly created content tables receive Source031 byline indexes`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      await new SchemaRegistry(fixture.database).createCollection({ slug: 'posts', label: 'Posts' });
      await migrateCms(fixture.database);
      const expected = { name: 'idx_ec_posts_primary_byline', type: 'index', tbl_name: 'ec_posts' };
      assert.deepEqual((await sql`SELECT name,type,tbl_name FROM sqlite_master WHERE name='idx_ec_posts_primary_byline'`
        .execute(fixture.database.db)).rows, [expected]);
      await new SchemaRegistry(fixture.database).createCollection({ slug: 'authors', label: 'Authors' });
      assert.deepEqual((await sql<{ name: string }>`PRAGMA index_info(idx_ec_authors_primary_byline)`.execute(fixture.database.db)).rows
        .map(row => row.name), ['primary_byline_id']);
      await fixture.reopen(); await migrateCms(fixture.database);
      assert.deepEqual((await sql<{ name: string }>`PRAGMA index_info(idx_ec_posts_primary_byline)`.execute(fixture.database.db)).rows
        .map(row => row.name), ['primary_byline_id']);
    } finally { await fixture.close(); }
  });
  test(`${mode}: a converted legacy reference remains usable after actual persisted reopen and startup`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      const registry = new SchemaRegistry(fixture.database);
      await registry.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post' });
      await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
      await registry.createCollection({ slug: 'authors', label: 'Authors', labelSingular: 'Author' });
      await registry.createField('authors', { slug: 'name', label: 'Name', type: 'string' });
      await registry.createField('posts', { slug: 'author', label: 'Author', type: 'reference', options: { collection: 'authors' } });
      const entries = new DraftRepository(fixture.database);
      const author = await entries.create({ type: 'authors', data: { name: 'Jane' } }, 'ordinary-migration-author');
      const post = await entries.create({ type: 'posts', data: { title: 'One' } }, 'ordinary-migration-author');
      await sql`UPDATE ec_posts SET author=${author.id} WHERE id=${post.id}`.execute(fixture.database.db);
      await migrateCms(fixture.database);
      const field = await fixture.database.db.selectFrom('_cms_fields').selectAll().where('slug', '=', 'author').executeTakeFirstOrThrow();
      assert.equal(JSON.parse(field.validation ?? '{}').relation, 'posts_author');
      const original = (await sql`SELECT * FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows;
      const originalEdges = (await sql`SELECT relation_id,parent_group,child_group,sort_order FROM _cms_content_references
        WHERE relation_id=${field.id}`.execute(fixture.database.db)).rows;
      assert.equal(originalEdges.length, 1);
      await fixture.reopen();
      await migrateCms(fixture.database);
      assert.deepEqual((await sql`SELECT * FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows, original);
      assert.deepEqual((await sql`SELECT relation_id,parent_group,child_group,sort_order FROM _cms_content_references
        WHERE relation_id=${field.id}`.execute(fixture.database.db)).rows, originalEdges);
      assert.deepEqual((await sql<{ name: string; type: string }>`PRAGMA table_info(ec_posts)`.execute(fixture.database.db)).rows.filter(row => row.name === 'author')
        .map(row => row.type), ['TEXT']);
      await new DraftRepository(fixture.database).findById('posts', post.id);
    } finally { await fixture.close(); }
  });
}
