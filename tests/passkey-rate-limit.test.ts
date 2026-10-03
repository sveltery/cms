// Original supplemental probes of the pinned rate-limit cleanup behavior.
// EmDash 913cb1bb core/src/auth/rate-limit.ts piggybacks expiry cleanup at 1%.
// These probes exercise the real CMS passkey options flow; no source test credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { identityDb } from '../src/lib/server/auth/identity-store.ts';
import { authenticationOptions } from '../src/lib/server/auth/passkey-flow.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: passkey options probabilistically delete expired counters and preserve current counters`, async t => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = identityDb(storage.database);
      await db.insertInto('_cms_auth_rate_limits').values([
        { key: 'old:entry', window: new Date(Date.now() - 7200 * 1000).toISOString(), count: 5 },
        { key: 'current:entry', window: new Date().toISOString(), count: 2 }
      ]).execute();
      t.mock.method(Math, 'random', () => 0);
      await authenticationOptions({ database: storage.database, publicOrigin: 'https://example.com', basePath: '', rpName: 'CMS' }, '1.2.3.4');
      // The source deliberately launches cleanup without awaiting it.
      const deadline = Date.now() + 1000;
      let rows = await db.selectFrom('_cms_auth_rate_limits').selectAll().execute();
      while (rows.some(row => row.key === 'old:entry') && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
        rows = await db.selectFrom('_cms_auth_rate_limits').selectAll().execute();
      }
      assert.equal(rows.length, 2);
      assert.equal(rows.some(row => row.key === 'old:entry'), false);
      assert.equal(rows.find(row => row.key === 'current:entry')?.count, 2);
      assert.equal(rows.find(row => row.key === '1.2.3.4:passkey/options')?.count, 1);
    } finally { await storage.close(); }
  });
}
