// Original current-user/native affordance supplement; no new copied source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRemotes } from '../helpers/passkey-remotes.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: current-user API denies anonymous requests without revealing identities`, async () => {
    const h = await passkeyRemotes(target);
    try {
      const response = await h.request('/api/auth/me', null);
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'NOT_AUTHENTICATED');
    } finally { await h.close(); }
  });
}
