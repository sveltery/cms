// Original native query/display integration, zero source parity credit.
// A deterministic isolated stored-session fixture represents an already signed-in
// minimal user. No credential ceremony, session issuance, concurrency or replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';
import { identityOptions } from '../../src/lib/server/auth/identity-store.ts';

const token = Buffer.alloc(32, 7).toString('base64url');
const state = z.object({ authenticated: z.boolean() });

for (const target of ['Node', 'D1'] as const) {
  for (const complete of [false, true]) {
    test(`${target}: profileless principal retains actual query/page controls with complete=${complete}`, async () => {
      const h = await passkeyRuntime(target), browser = h.browser();
      try {
        assert.equal((await browser.get('/api/setup/status')).status, 200);
        const database = await h.database();
        const user = { id: 'legacy-display-fixture', role: 50, disabled: 0 };
        const hash = await hashSessionToken(token);
        assert.ok(hash);
        const session = { hash, user_id: user.id, expires_at: Date.now() + 600_000 };
        await database.db.insertInto('_cms_auth_users').values(user).execute();
        await database.db.insertInto('_cms_auth_sessions').values(session).execute();
        if (complete) await identityOptions(database).set('emdash:setup_complete', true);
        browser.cookies.set('cms-session', token);

        // The real profile join stays null; no fallback identity is invented.
        assert.equal((await browser.query('getCurrentUser')).data, null);
        assert.equal((await browser.get('/api/auth/me')).status, 401);
        const response = await browser.get('/login');
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /Administrator enrollment support is not implemented/);
        assert.match(html, />Open your workspace<\/a>/);
        assert.match(html, /<form[^>]*action="[^"]*\/logout"/);
        assert.match(html, /<button[^>]*>Sign out<\/button>/);
        assert.doesNotMatch(html, /Signed in as|Sign in with a passkey|Set up your administrator account/);
        assert.deepEqual(state.parse((await browser.query('getAuthenticatedState')).data), { authenticated: true });
        assert.deepEqual(await database.db.selectFrom('_cms_auth_users').selectAll().execute(), [user]);
        assert.deepEqual(await database.db.selectFrom('_cms_auth_sessions').selectAll().execute(), [session]);
        assert.equal((await database.db.selectFrom('_cms_auth_profiles').selectAll().execute()).length, 0);
        assert.equal((await database.db.selectFrom('_cms_auth_credentials').selectAll().execute()).length, 0);

        // Ordinary native sign-out revokes only this isolated fixture row.
        const signedOut = await browser.submitNative(`/_app/remote/${h.ids.logout}`);
        assert.equal(signedOut.status, 303);
        assert.equal(signedOut.headers.get('location'), '/login');
        assert.equal((await database.db.selectFrom('_cms_auth_sessions').selectAll().execute()).length, 0);
        assert.deepEqual(state.parse((await browser.query('getAuthenticatedState')).data), { authenticated: false });
        const anonymous = await browser.get('/login');
        const anonymousHtml = await anonymous.text();
        assert.match(anonymousHtml, /Administrator enrollment support is not implemented/);
        assert.doesNotMatch(anonymousHtml, /Open your workspace|Sign out|Sign in with a passkey/);
        assert.deepEqual(await database.db.selectFrom('_cms_auth_users').selectAll().execute(), [user]);
        assert.equal((await database.db.selectFrom('_cms_auth_profiles').selectAll().execute()).length, 0);
        assert.equal((await database.db.selectFrom('_cms_auth_credentials').selectAll().execute()).length, 0);
      } finally { await h.close(); }
    });
  }
}
