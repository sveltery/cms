// Original ordinary migration requirements, not protected relation-binding-race probes.
// Zero copied Source callback credit. Whole Source087 authorities/tests stay immutable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms, CMS_MIGRATIONS } from '../src/lib/server/database/migrations.ts';
import { createRequestScopedDb } from '../src/lib/server/runtime/cloudflare-d1.ts';
import { installVersion4 } from './helpers/lifecycle-startup.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';

async function fixture(mode: 'Node' | 'raw D1' | 'scoped D1') {
  const worker = mode === 'Node' ? null : new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("ordinary legacy storage"); } }',
    compatibilityDate: '2026-05-07', d1Databases: { CMS_DB: 'canonical-legacy-reference' },
    host: '127.0.0.1', port: 0, cf: false });
  const binding = worker ? await worker.getD1Database('CMS_DB') : null;
  const raw = binding ? openD1(binding) : openSqlite(':memory:');
  const scope = mode === 'scoped D1' ? createRequestScopedDb({
    config: { binding: 'CMS_DB', session: 'auto', coalesce: true },
    binding: binding as unknown as D1Database, isAuthenticated: false, isWrite: true,
    cookies: { get() { return undefined; }, set() {} }, url: new URL('https://ordinary-legacy-storage.invalid/')
  }) : null;
  if (mode === 'scoped D1') assert.ok(scope);
  const database = scope?.database ?? raw;
  try {
    // Actual immutable public1–5 provider bodies, never a marker-only setup.
    await installVersion4(database);
    const lifecycle = CMS_MIGRATIONS.find(provider => provider.version === 5);
    assert.ok(lifecycle);
    await database.atomicBatch([...await lifecycle.statements(database),
      sql`INSERT INTO _cms_migrations(version) VALUES (5)`.compile(database.db)]);
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post' });
    await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
    await registry.createCollection({ slug: 'authors', label: 'Authors', labelSingular: 'Author' });
    await registry.createField('authors', { slug: 'name', label: 'Name', type: 'string' });
    return { database, registry, entries: new DraftRepository(database), async close() {
      try { if (scope) await scope.database.close(); await raw.close(); }
      finally { await worker?.dispose(); }
    } };
  } catch (error) {
    try { if (scope) await scope.database.close(); await raw.close(); }
    finally { await worker?.dispose(); }
    throw error;
  }
}

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${mode}: canonical upgrade carries an existing legacy reference into directed group edges`, { timeout: 90_000 }, async () => {
    const f = await fixture(mode);
    try {
      await f.registry.createField('posts', { slug: 'author', label: 'Author', type: 'reference',
        options: { collection: 'authors' } });
      const author = await f.entries.create({ type: 'authors', slug: 'jane', data: { name: 'Jane' } }, 'ordinary-migration-author');
      const post = await f.entries.create({ type: 'posts', slug: 'one', data: { title: 'One' } }, 'ordinary-migration-author');
      // Native DraftEntry does not expose the stored Source translation group.
      // Read the two actual native rows; no fabricated migration query results.
      const authorGroup = (await sql<{ translation_group: string }>`SELECT translation_group FROM ec_authors WHERE id=${author.id}`
        .execute(f.database.db)).rows[0].translation_group;
      const postGroup = (await sql<{ translation_group: string }>`SELECT translation_group FROM ec_posts WHERE id=${post.id}`
        .execute(f.database.db)).rows[0].translation_group;
      await sql`UPDATE ec_posts SET author = ${author.id} WHERE id = ${post.id}`.execute(f.database.db);
      await migrateCms(f.database);
      const field = await f.database.db.selectFrom('_cms_fields').selectAll().where('slug', '=', 'author').executeTakeFirstOrThrow();
      const validation = JSON.parse(field.validation ?? '{}');
      assert.equal(validation.relation, 'posts_author');
      assert.equal(validation.relationSide, 'parent');
      assert.equal(validation.targetCollection, 'authors');
      assert.equal(validation.multiple, false);
      const relation = (await sql<{ id: string; max_children_per_parent: number }>`
        SELECT id,max_children_per_parent FROM _cms_relations WHERE slug='posts_author'`.execute(f.database.db)).rows[0];
      assert.equal(relation.id, field.id); assert.equal(relation.max_children_per_parent, 1);
      const edges = (await sql<{ parent_group: string; child_group: string; sort_order: number }>`
        SELECT parent_group,child_group,sort_order FROM _cms_content_references WHERE relation_id=${field.id}`.execute(f.database.db)).rows;
      assert.deepEqual(edges.map(row=>({...row})), [{ parent_group: postGroup, child_group: authorGroup, sort_order: 0 }]);
      const retained = (await sql<{ author: string }>`SELECT author FROM ec_posts WHERE id=${post.id}`.execute(f.database.db)).rows[0];
      assert.equal(retained.author, author.id);
      await migrateCms(f.database);
      assert.deepEqual((await sql`SELECT parent_group,child_group,sort_order FROM _cms_content_references WHERE relation_id=${field.id}`
        .execute(f.database.db)).rows, edges);
    } finally { await f.close(); }
  });
}
