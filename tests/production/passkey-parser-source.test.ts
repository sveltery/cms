// Original actual-runtime HTTP probe of pinned optional JSON body parsing.
// No identity seed, hook replacement or copied source declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: malformed options body still schedules source challenge cleanup and consumes a rate slot`, async () => {
    const h = await passkeyRuntime(target);
    try {
      assert.equal((await h.request('/api/setup/status')).status, 200);
      const db = await h.database();
      await db.db.insertInto('_cms_auth_challenges').values({ challenge: 'expired-fixture', type: 'authentication',
        user_id: null, data: null, expires_at: new Date(0).toISOString(), created_at: new Date(0).toISOString() }).execute();
      const response = await h.request('/api/auth/passkey/options', {
        method: 'POST', body: '[', headers: { origin: h.origin, 'content-type': 'application/json' }
      });
      assert.equal(response.status, 400);
      const deadline = Date.now() + 2_000;
      let remaining = 1;
      while (remaining && Date.now() < deadline) {
        remaining = (await db.db.selectFrom('_cms_auth_challenges').selectAll().execute()).length;
        if (remaining) await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.equal(remaining, 0);
      const counters = await db.db.selectFrom('_cms_auth_rate_limits').selectAll().execute();
      assert.equal(counters.length, 1);
      assert.equal(counters[0].count, 1);
    } finally { await h.close(); }
  });
  test(`${target}: login options accept whitespace-only optional JSON body like pinned parser`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const response = await h.request('/api/auth/passkey/options', {
        method: 'POST', body: ' \n\t', headers: { origin: h.origin, 'content-type': 'application/json' }
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.options.allowCredentials, undefined);
      const db = await h.database();
      assert.equal((await db.db.selectFrom('_cms_auth_users').selectAll().execute()).length, 0);
    } finally { await h.close(); }
  });
}
