// Original actual-runtime HTTP probe of pinned optional JSON body parsing.
// No identity seed, hook replacement or copied source declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';

for (const target of ['Node', 'D1'] as const) {
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
