import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
// Original dependency regression, zero EmDash declaration credit.
// Source012_search adds nullable search_config; native schema3 had not supplied it.
test('canonical startup persists the search configuration column', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const columns = (await sql<{ name: string }>`PRAGMA table_info(_cms_collections)`.execute(database.db)).rows;
    assert.equal(columns.some(column => column.name === 'search_config'), true);
  } finally { await database.close(); }
});
