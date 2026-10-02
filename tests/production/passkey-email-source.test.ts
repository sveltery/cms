// Original supplemental probes of exact pinned email decisions; no source test credit.
// Source setup.ts/auth.ts use Zod 4.5.4 z.email() at EmDash 913cb1bb.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRemotes } from '../helpers/passkey-remotes.ts';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';

for (const target of ['Node', 'D1'] as const) {
  for (const endpoint of ['/api/setup/admin', '/api/auth/passkey/options']) {
    test(`${target}: ${endpoint} preserves source apostrophe-email acceptance and malformed-email rejection`, async () => {
      const h = await passkeyRemotes(target);
      try {
        const browser = h.browser();
        assert.equal((await browser.post(endpoint, { email: "o'connor@example.com" })).status, 200);
        assert.equal((await browser.post(endpoint, { email: 'o..connor@example.com' })).status, 400);
      } finally { await h.close(); }
    });
  }
  test(`${target}: native setup form preserves source apostrophe-email acceptance`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const browser = h.browser();
      const html = await (await browser.get('/setup')).text();
      const action = [...html.matchAll(/<form[^>]*action="([^"]+)"[^>]*>/g)]
        .map(match => match[1]).find(action => action.includes('/beginSetup'));
      assert.ok(action, 'actual native setup action');
      const url = new URL(action.replaceAll('&amp;', '&'), `${h.origin}/setup`);
      await browser.submitNative(url.pathname + url.search, new URLSearchParams({ email: "o'connor@example.com" }));
      assert.ok(browser.cookies.has('emdash_setup_nonce'), 'accepted setup request issues the source nonce');
      const database = await h.database();
      assert.equal((await database.db.selectFrom('_cms_auth_users').selectAll().execute()).length, 0);
    } finally { await h.close(); }
  });
}
