// Original guard-order probes for immutable EmDash 1.1.0 setup handlers.
// admin.ts b2a5d3923286a67caa0e8e7260ce47d8d613e86e;
// admin-verify.ts 734f2ac531e29ab0a793fe7293c9e7d769c5b1fd.
// Source guard/status results are reproduced separately with unchanged source modules.
// Actual Kit HTTP and real signed registration; zero copied declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';

for (const target of ['Node', 'D1'] as const) {
  for (const scenario of ['absent state', 'absent cookie', 'mismatching cookie'] as const) {
    test(`${target}: setup verification rejects ${scenario} before parsing malformed JSON`, async () => {
      const h = await passkeyRuntime(target);
      try {
        if (scenario !== 'absent state') {
          assert.equal((await h.browser().post('/api/setup/admin', { email: 'guard@example.com' })).status, 200);
        }
        const response = await h.request('/api/setup/admin/verify', {
          method: 'POST', headers: { origin: h.origin, 'content-type': 'application/json',
            ...(scenario === 'mismatching cookie' ? { cookie: 'emdash_setup_nonce=wrong' } : {}) }, body: '['
        });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, 'INVALID_STATE');
      } finally { await h.close(); }
    });
  }
  for (const path of ['/api/setup/admin', '/api/setup/admin/verify']) {
    test(`${target}: completed ${path} rejects setup before parsing malformed JSON`, async () => {
      const h = await passkeyRuntime(target);
      try {
        const browser = h.browser(), credential = webauthnCredential(h.origin);
        const begin = await browser.post('/api/setup/admin', { email: 'guard@example.com' });
        assert.equal(begin.status, 200);
        const options = (await begin.json()).data.options;
        assert.equal((await browser.post('/api/setup/admin/verify', {
          credential: credential.registration(options.challenge)
        })).status, 200);
        const response = await h.request(path, { method: 'POST',
          headers: { origin: h.origin, 'content-type': 'application/json' }, body: '[' });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, 'SETUP_COMPLETE');
      } finally { await h.close(); }
    });
  }
}
