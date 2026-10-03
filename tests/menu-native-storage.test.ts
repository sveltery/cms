import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';

// Original native namespace checks corresponding to the two Source migration
// declarations. Their changed namespace means they earn zero Source credit.
for (const name of ['_cms_menus', '_cms_menu_items']) {
  test(`ordinary native storage has persisted ${name}`, async () => {
    const storage = openSqlite(':memory:');
    try {
      await migrateCms(storage);
      const tables = await storage.db.introspection.getTables();
      assert.equal(tables.some(table => table.name === name), true);
    } finally {
      await storage.close();
    }
  });
}
