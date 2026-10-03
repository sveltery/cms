import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { menuSchemaStatements } from '../src/lib/server/menus/migrations.ts';
import { handleMenuCreate, handleMenuList, handleMenuGet } from '../src/lib/server/menus/handlers.ts';
import type { Database } from '../src/lib/server/menus/database-types.ts';

// Original native transport/storage expectations. The descriptor is applied
// explicitly as a named fixture, with zero canonical-startup or Source credit.
async function fixture() {
  const storage = openSqlite(':memory:');
  await migrateCms(storage);
  await storage.atomicBatch(menuSchemaStatements(storage));
  return { storage, db: storage.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>() };
}

test('actual native menu handler lists empty persisted storage successfully', async () => {
  const { storage, db } = await fixture();
  try {
    const result = await handleMenuList(db);
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data, []);
  } finally { await storage.close(); }
});

test('actual native menu handler persists a menu and its translation identity', async () => {
  const { storage, db } = await fixture();
  try {
    const result = await handleMenuCreate(db, { name: 'primary', label: 'Primary' });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.translationGroup, result.data.id);
      const loaded = await handleMenuGet(db, 'primary');
      assert.equal(loaded.success, true);
      if (loaded.success) assert.equal(loaded.data.id, result.data.id);
    }
  } finally { await storage.close(); }
});
