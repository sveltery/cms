// Original supplemental probe of pinned setup/admin-verify.ts completion.
// No source declaration credit; real signed credential and unchanged actual hooks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';
import { identityOptions } from '../../src/lib/server/auth/identity-store.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: passkey completion discards wizard title/tagline like pinned route`, async () => {
    const h = await passkeyRuntime(target);
    try {
      assert.equal((await h.request('/api/setup/status')).status, 200);
      const options = identityOptions(await h.database());
      await options.set('emdash:site_title', 'Stored title');
      await options.set('emdash:site_tagline', 'Stored tagline');
      await options.set('emdash:setup_state', { step: 'site', title: 'Wizard title', tagline: 'Wizard tagline' });
      const browser = h.browser(), credential = webauthnCredential(h.origin);
      const began = await browser.post('/api/setup/admin', { email: 'admin@example.com' });
      assert.equal(began.status, 200);
      const challenge = (await began.json()).data.options.challenge;
      const verified = await browser.post('/api/setup/admin/verify', { credential: credential.registration(challenge) });
      assert.equal(verified.status, 200);
      assert.equal(await options.get('emdash:site_title'), 'Stored title');
      assert.equal(await options.get('emdash:site_tagline'), 'Stored tagline');
      assert.equal(await options.get('emdash:setup_state'), null);
      assert.equal(await options.get('emdash:setup_complete'), true);
    } finally { await h.close(); }
  });
}
