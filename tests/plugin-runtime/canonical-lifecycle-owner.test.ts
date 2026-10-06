import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { pluginSourceDatabase, registeredPluginDatabaseOwner, assertRegisteredPluginNamespace } from '../../src/lib/server/plugins/database.ts';
import { withTransaction } from '../../src/lib/server/plugins/transaction.ts';
import { lifecycleDatabase, registerLifecycleDatabase, siteTimezone } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import * as lifecycleHost from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
const opened: CmsDatabase[] = [];
afterEach(async () => { for (const database of opened.splice(0)) await database.close(); });
async function fixture() {
  const database = openSqlite(':memory:'); opened.push(database); await migrateCms(database);
  return { database, db: pluginSourceDatabase(database) };
}
describe('sole canonical lifecycle owner association for plugin views', () => {
  it('retains the exact trusted after callback for the owner, ordinary view and genuine transaction', async () => {
    const database = openSqlite(':memory:'); opened.push(database); await migrateCms(database);
    const queued: Array<() => void | Promise<void>> = [];
    const after = (task: () => void | Promise<void>) => { queued.push(task); };
    registerLifecycleDatabase(database, { timezone: async () => 'Europe/Berlin', after });
    const db = pluginSourceDatabase(database);
    // The proposed read-only metadata seam is a prerequisite for this observer;
    // an absent reader is not a Source or Native causal behavior failure.
    const read = Reflect.get(lifecycleHost, 'lifecycleDependencies') as (db: object) => { after?: typeof after } | undefined;
    let completed = 0;
    for (const current of [database.db, db]) {
      expect(read(current)?.after).toBe(after);
      read(current)?.after?.(() => { completed++; });
    }
    await withTransaction(db, async trx => {
      expect(read(trx)?.after).toBe(after);
      read(trx)?.after?.(() => { completed++; });
    });
    expect(completed).toBe(0);
    for (const task of queued) await task();
    expect(completed).toBe(3);
  });
  it('preserves the already registered owner timezone when creating its ordinary namespace view', async () => {
    const database = openSqlite(':memory:'); opened.push(database); await migrateCms(database);
    registerLifecycleDatabase(database, { timezone: async () => 'Europe/Berlin', after: task => { void task(); } });
    const db = pluginSourceDatabase(database);
    expect(await siteTimezone(database.db)).toEqual({ value: '"Europe/Berlin"' });
    expect(await siteTimezone(db)).toEqual({ value: '"Europe/Berlin"' });
  });
  it('inherits the genuine owner timezone through the actual existing transaction', async () => {
    const database = openSqlite(':memory:'); opened.push(database); await migrateCms(database);
    registerLifecycleDatabase(database, { timezone: async () => 'Pacific/Auckland', after: task => { void task(); } });
    const db = pluginSourceDatabase(database);
    await withTransaction(db, async trx => {
      expect(await siteTimezone(trx)).toEqual({ value: '"Pacific/Auckland"' });
    });
  });
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
