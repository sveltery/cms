import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { historicalFeatureStorage, type StorageMode } from './helpers/canonical-feature-storage-original.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { RelationRepository } from '../src/lib/server/relations/repository.ts';
import { relationService } from '../src/lib/server/relations/service.ts';
import { servicePrincipal } from '../src/lib/server/auth/composition.ts';
import { Role } from '../src/lib/server/auth/roles.ts';

// Supplemental native controls for actual published provider10 conversion.
// Pinned Source registry.ts1746 and reference-field-lifecycle.test.ts146 require
// deleting a retained physical column. No copied Source callback credit, new
// credential/session/HTTP probe, or concurrent relation mutation is introduced.
async function convertedLegacyFixture(mode: StorageMode) {
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
    await fixture.reopen();
    await migrateCms(fixture.database);
    const field = await fixture.database.db.selectFrom('_cms_fields').selectAll().where('slug', '=', 'author').executeTakeFirstOrThrow();
    assert.equal(JSON.parse(field.validation ?? '{}').relation, 'posts_author');
    assert.deepEqual((await sql<{ name: string; type: string }>`PRAGMA table_info(ec_posts)`.execute(fixture.database.db)).rows
      .filter(row => row.name === 'author').map(row => row.type), ['TEXT']);
    const relation = await new RelationRepository(fixture.database).findBySlug('posts_author');
    assert.ok(relation);
    assert.equal(await new RelationRepository(fixture.database).countChildren(relation.id, post.id), 1);
    return { fixture, field, relation, post, author };
  } catch (cause) {
    await fixture.close();
    throw cause;
  }
}

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const satisfies readonly StorageMode[]) {
  test(`${mode} deleting a converted relation removes its retained column and allows field slug reuse`, { timeout: 90_000 }, async () => {
    const { fixture, relation, post } = await convertedLegacyFixture(mode);
    try {
      const registry = new SchemaRegistry(fixture.database);
      const service = relationService(fixture.database, servicePrincipal({ id: 'ordinary-original-unit-admin', role: Role.ADMIN }));
      const deleted = await service.delete(relation.id);
      assert.equal(deleted.success, true);
      assert.equal(await registry.getField('posts', 'author'), null);
      assert.equal(await new RelationRepository(fixture.database).findById(relation.id), null);
      assert.deepEqual((await sql`SELECT * FROM _cms_content_references WHERE relation_id=${relation.id}`.execute(fixture.database.db)).rows, []);
      assert.equal((await sql<{ name: string }>`PRAGMA table_info(ec_posts)`.execute(fixture.database.db)).rows
        .some(column => column.name === 'author'), false, 'the actual retained legacy column must be dropped');
      await registry.createField('posts', { slug: 'author', label: 'Reused author', type: 'string' });
      await sql`UPDATE ec_posts SET author='Reused' WHERE id=${post.id}`.execute(fixture.database.db);
      assert.equal((await sql<{ author: string }>`SELECT author FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows[0].author, 'Reused');
    } finally { await fixture.close(); }
  });

  test(`${mode} failed converted relation cascade rolls back retained columns and the persisted graph`, { timeout: 90_000 }, async () => {
    const { fixture, field, relation, post, author } = await convertedLegacyFixture(mode);
    try {
      const before = (await sql`SELECT * FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows;
      const beforeEdges = (await sql`SELECT * FROM _cms_content_references WHERE relation_id=${relation.id}`.execute(fixture.database.db)).rows;
      await sql`CREATE TRIGGER relation_legacy_cascade_abort BEFORE DELETE ON _cms_relations
        WHEN OLD.slug = 'posts_author' BEGIN SELECT RAISE(ABORT, 'actual legacy cascade fixture failure'); END`.execute(fixture.database.db);
      const service = relationService(fixture.database, servicePrincipal({ id: 'ordinary-original-unit-admin', role: Role.ADMIN }));
      const deleted = await service.delete(relation.id);
      assert.equal(deleted.success, false);
      assert.ok(await new SchemaRegistry(fixture.database).getField('posts', 'author'));
      assert.equal((await fixture.database.db.selectFrom('_cms_fields').select('id').where('id', '=', field.id).execute()).length, 1);
      assert.deepEqual((await sql`SELECT * FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows, before);
      assert.equal((await sql<{ author: string }>`SELECT author FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows[0].author, author.id);
      assert.deepEqual((await sql`SELECT * FROM _cms_content_references WHERE relation_id=${relation.id}`.execute(fixture.database.db)).rows, beforeEdges);
      assert.ok(await new RelationRepository(fixture.database).findById(relation.id));
    } finally { await fixture.close(); }
  });
}
