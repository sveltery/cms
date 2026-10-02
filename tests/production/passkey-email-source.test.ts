// Original supplemental probes of exact pinned email decisions; no source test credit.
// Source setup.ts/auth.ts use Zod 4.5.4 z.email() at EmDash 913cb1bb.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRemotes } from '../helpers/passkey-remotes.ts';

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
}
