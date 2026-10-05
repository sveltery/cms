import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';

// Original native requirement: exercise published canonical tables and real rows.
// Availability red is not an original EmDash assertion or causal Source red.
test('relations backend persists definitions and ordered inverse edges on canonical storage', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'post', label: 'Posts' });
    await registry.createCollection({ slug: 'page', label: 'Pages' });
    const loaded = await import('../src/lib/server/relations/repository.ts').catch(() => null);
    assert.equal(typeof loaded?.RelationRepository, 'function', 'actual relations repository must exist');
    const repo = new loaded!.RelationRepository(database);
    const relation = await repo.create({ slug: 'related', parentCollection: 'post', childCollection: 'page', parentLabel: 'Post', childLabel: 'Page' });
    await repo.setChildren(relation.id, 'post-group', ['page-b', 'page-a', 'page-b']);
    assert.deepEqual((await repo.getChildren(relation.slug, 'post-group')).map(edge => [edge.childGroup, edge.sortOrder]), [['page-b', 0], ['page-a', 1]]);
    assert.equal((await repo.getParents(relation.id, 'page-a'))[0].parentGroup, 'post-group');
    assert.equal((await repo.findBySlug('related'))?.id, relation.id);
  } finally { await database.close(); }
});
