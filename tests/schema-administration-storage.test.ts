import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';

// Supplemental persistence case for the source deleteField columnExists contract.
// A legacy bound reference can retain its pre-binding physical column.
test('deleting a bound legacy reference drops its retained physical column before reusing its slug', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database); const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await registry.createField('posts', { slug: 'related', label: 'Related', type: 'string' });
    await sql`UPDATE _cms_fields SET type = 'reference', validation = '{"relation":"posts_related","relationSide":"parent","targetCollection":"posts"}' WHERE slug = 'related'`.execute(database.db);
    await registry.deleteField('posts', 'related');
    const columns = (await sql<{name:string}>`PRAGMA table_info(ec_posts)`.execute(database.db)).rows;
    assert.equal(columns.some(column => column.name === 'related'), false);
    await registry.createField('posts', { slug: 'related', label: 'Reused', type: 'string' });
    assert.equal((await registry.getField('posts', 'related'))!.type, 'string');
  } finally { await database.close(); }
});
