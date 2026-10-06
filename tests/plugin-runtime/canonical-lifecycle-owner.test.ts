import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { pluginSourceDatabase, registeredPluginDatabaseOwner, assertRegisteredPluginNamespace } from '../../src/lib/server/plugins/database.ts';
import { withTransaction } from '../../src/lib/server/plugins/transaction.ts';
import { lifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
const opened: CmsDatabase[] = [];
afterEach(async () => { for (const database of opened.splice(0)) await database.close(); });
async function fixture() {
  const database = openSqlite(':memory:'); opened.push(database); await migrateCms(database);
  return { database, db: pluginSourceDatabase(database) };
}
describe('sole canonical lifecycle owner association for plugin views', () => {
  it('associates the genuine owner namespace while preserving its actual executor plugins', async () => {
    const { database, db } = await fixture();
    expect(registeredPluginDatabaseOwner(db)).toBe(database);
    expect(db.getExecutor().plugins).toEqual(expect.arrayContaining(database.db.getExecutor().plugins));
    expect(lifecycleDatabase(db)?.db).toBe(db);
  });
  it('associates only the genuine current transaction executor', async () => {
    const { db } = await fixture();
    await withTransaction(db, async trx => {
      expect(trx.isTransaction).toBe(true);
      expect(trx.getExecutor().plugins).toEqual(db.getExecutor().plugins);
      expect(lifecycleDatabase(trx)?.db).toBe(trx);
    });
  });
  it('refuses unknown derived namespace handles and leaves the lifecycle association absent', async () => {
    const { db } = await fixture();
    const derived = db.withPlugin({ transformQuery: args => args.node, transformResult: async args => args.result });
    expect(() => assertRegisteredPluginNamespace(derived)).toThrow('registered CMS database owner');
    expect(lifecycleDatabase(derived)).toBeUndefined();
  });
});
