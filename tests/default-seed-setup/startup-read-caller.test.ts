// Supplemental Native conservative setup metadata read failure; no HTTP,
// identity/session/credential/account action or Source causal credit.
import { expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { initializeConfiguredDefaultSeed } from '../../src/lib/server/runtime/default-seed.ts';

it('unreadable existing account completion metadata conservatively skips default seed without failing startup', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const cause = new Error('actual caller completion query unavailable');
    let accountReads = 0;
    const guarded = { ...database, db: database.db.withPlugin({
      transformQuery({ node }) {
        if (JSON.stringify(node).includes('_cms_auth_setup')) { accountReads++; throw cause; }
        return node;
      },
      async transformResult({ result }) { return result; }
    }) };
    await expect(initializeConfiguredDefaultSeed(guarded, { kind: 'sqlite', path: 'native-read-failure-control' })).resolves.toBeUndefined();
    expect(accountReads).toBe(1);
    expect(await database.db.selectFrom('_cms_collections').selectAll().execute()).toEqual([]);
    expect(await database.db.selectFrom('_cms_auth_setup').selectAll().execute()).toEqual([]);
  } finally { await database.close(); }
});
