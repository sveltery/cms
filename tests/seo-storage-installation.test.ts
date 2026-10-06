import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { asyncD1Storage } from './helpers/async-d1-storage.ts';

// Native canonical installation requirements, separate from Source callbacks.
for (const runtime of ['node', 'd1'] as const) {
  test('ordinary ' + runtime + ' installation provides persisted SEO storage', async () => {
    const storage = runtime === 'd1' ? await asyncD1Storage() : undefined;
    const database = storage ? openD1(storage.binding) : openSqlite(':memory:');
    try {
      await migrateCms(database);
      const tables = (await sql<{ name: string }>`SELECT name FROM sqlite_master
        WHERE type='table' AND name='_cms_seo'`.execute(database.db)).rows;
      assert.deepEqual(tables.map(row => row.name), ['_cms_seo']);
    } finally {
      await database.close();
      await storage?.runtime.dispose();
    }
  });
}
