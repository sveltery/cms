// Supplemental actual-hook integration; fixture creates no identities or sessions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: anonymous configured runtime exposes setup after canonical identity migration`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const response = await h.request('/api/setup/status');
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.needsSetup, true);
      const db = await h.database();
      assert.deepEqual((await db.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row => row.version), [1, 2, 3, 4]);
      assert.equal((await db.db.selectFrom('_cms_auth_users').selectAll().execute()).length, 0);
      assert.equal((await db.db.selectFrom('_cms_auth_sessions').selectAll().execute()).length, 0);
    } finally { await h.close(); }
  });
}
