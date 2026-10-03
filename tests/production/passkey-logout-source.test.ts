// Adapted source assertions, EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.
// Pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/tests/unit/auth/logout-route.test.ts:14,20, blob0bfa8eb20126e4db7d84775f313715755e3e517d.
// Actual Kit HTTP and canonical migrated storage replace Astro's session stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRemotes } from '../helpers/passkey-remotes.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: source logout redirects to a same-site path`, async () => {
    const h = await passkeyRemotes(target);
    try {
      const response = await h.request('/api/auth/logout?redirect=/blog', null, {
        method: 'POST', headers: { origin: h.origin }, redirect: 'manual'
      });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('Location'), '/blog');
    } finally { await h.close(); }
  });
  for (const control of ['%09', '%0A', '%0D']) {
    test(`${target}: source logout ignores redirect with ${control} between slashes`, async () => {
      const h = await passkeyRemotes(target);
      try {
        const response = await h.request(`/api/auth/logout?redirect=/${control}/evil.example`, null, {
          method: 'POST', headers: { origin: h.origin }, redirect: 'manual'
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Location'), null);
      } finally { await h.close(); }
    });
  }
}
