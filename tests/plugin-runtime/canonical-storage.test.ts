import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { pluginSourceDatabase } from '../../src/lib/server/plugins/database.ts';
import { PluginStorageRepository } from '../../src/lib/server/plugins/storage-repository.ts';
import { withTransaction } from '../../src/lib/server/plugins/transaction.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
const opened: CmsDatabase[] = [];
afterEach(async () => { for (const database of opened.splice(0)) await database.close(); });
async function fixture() {
  const database = openSqlite(':memory:'); opened.push(database); await migrateCms(database);
  const db = pluginSourceDatabase(database);
  return { database, db, repository: new PluginStorageRepository<{ score: number }>(db, 'plugin', 'records', ['score']) };
}
describe('actual canonical plugin document storage', () => {
  it('uses one real canonical batch for the whole document list and isolates plugin keys', async () => {
    const { database, db, repository } = await fixture();
    const batch = database.atomicBatch.bind(database); let batches = 0;
    database.atomicBatch = async statements => { batches++; return batch(statements); };
    await repository.putMany([{ id: 'one', data: { score: 1 } }, { id: 'two', data: { score: 2 } }]);
    expect(batches).toBe(1);
    expect(await repository.get('two')).toEqual({ score: 2 });
    expect(await new PluginStorageRepository(db, 'other-plugin', 'records', ['score']).get('two')).toBeNull();
    expect(await database.db.selectFrom('_cms_plugin_storage').selectAll().execute()).toHaveLength(2);
  });
  it('keeps a nested document list inside the actual outer transaction and rolls it back', async () => {
    const { database, db } = await fixture();
    const batch = database.atomicBatch.bind(database); let inside = false;
    // Reject the invalid handoff before it could wait on the connection mutex.
    // This observer preserves the genuine database/executor and every valid batch.
    database.atomicBatch = async statements => { if (inside) throw new Error('Nested owner batch escaped transaction'); return batch(statements); };
    await expect(withTransaction(db, async trx => {
      inside = true;
      try {
        await new PluginStorageRepository(trx, 'plugin', 'records', []).putMany([{ id: 'one', data: { score: 1 } }]);
        throw new Error('outer rollback');
      } finally { inside = false; }
    })).rejects.toThrow('outer rollback');
    expect(await database.db.selectFrom('_cms_plugin_storage').selectAll().execute()).toHaveLength(0);
  });
  it('does not grant a canonical writer to an unregistered derived namespace handle', async () => {
    const { db } = await fixture();
    const derived = db.withPlugin({ transformQuery: args => args.node, transformResult: async args => args.result });
    expect(() => new PluginStorageRepository(derived, 'plugin', 'records', [])).toThrow('registered CMS database owner');
  });
});
