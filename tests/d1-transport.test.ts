// Original native harness tests. No copied EmDash assertions or parity credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { withPriorD1Notification } from './helpers/d1-notification-interleaving.ts';

test('D1 fixture matches each response when a prior synchronous notification arrives late', { timeout: 15000 }, async () => {
  await withPriorD1Notification(async arm => {
    const { schemaAdminStorage } = await import('./helpers/schema-admin-storage.ts');
    const storage = await schemaAdminStorage('D1');
    try {
      arm();
      const result = await sql<{ answer: number }>`SELECT 41 + 1 AS answer`.execute(storage.database.db);
      assert.deepEqual(result.rows, [{ answer: 42 }]);
    } finally { await storage.close(); }
  });
});
