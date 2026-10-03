// Original probes preserve a verified shared bug at EmDash 1.1.0 immutable pin
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; zero copied source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: shared-source setup prefers residency but login omits credential IDs`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const browser = h.browser(), credential = webauthnCredential(h.origin);
      const begin = await browser.post('/api/setup/admin', { email: 'reference@example.com' });
      assert.equal(begin.status, 200);
      const registration = (await begin.json()).data.options;
      assert.equal(registration.authenticatorSelection.residentKey, 'preferred');
      assert.equal((await browser.post('/api/setup/admin/verify', { credential: credential.registration(registration.challenge) })).status, 200);
      const response = await browser.post('/api/auth/passkey/options', {});
      assert.equal(response.status, 200);
      const login = (await response.json()).data.options;
      assert.equal(Object.hasOwn(login, 'allowCredentials'), false);
      assert.equal((await (await h.database()).db.selectFrom('_cms_auth_credentials').selectAll().execute()).length, 1);
    } finally { await h.close(); }
  });
}
