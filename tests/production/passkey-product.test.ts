// Supplemental real signed credentials, actual hooks and persisted Node/raw D1 runtime.
// No user/session seed or WebAuthn verifier stub is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';

async function setup(h: Awaited<ReturnType<typeof passkeyRuntime>>) {
  const browser = h.browser(), credential = webauthnCredential(h.origin);
  const began = await browser.post('/api/setup/admin', { email: 'ADMIN@example.com', name: 'Real Admin' });
  assert.equal(began.status, 200);
  const options = (await began.json()).data.options;
  assert.equal(options.rp.id, 'localhost');
  const verified = await browser.post('/api/setup/admin/verify', { credential: credential.registration(options.challenge) });
  assert.equal(verified.status, 200, JSON.stringify(await verified.clone().json()));
  const user = (await verified.json()).data.user;
  return { browser, credential, user, verified };
}
async function login(h: Awaited<ReturnType<typeof passkeyRuntime>>, state: Awaited<ReturnType<typeof setup>>, counter = 1) {
  const options = await state.browser.post('/api/auth/passkey/options', {});
  assert.equal(options.status, 200);
  const challenge = (await options.json()).data.options.challenge;
  const response = await state.browser.post('/api/auth/passkey/verify', { credential: state.credential.assertion(challenge, counter) });
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  return response;
}
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: real registration then signed login persists hash-only session and current-role authority across restart`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const state = await setup(h);
      assert.equal(state.user.email, 'admin@example.com'); assert.equal(state.user.role, 50);
      assert.equal(state.browser.cookies.has('emdash_setup_nonce'), false);
      assert.equal(state.browser.cookies.has('cms-session'), false); // Source setup does not authenticate.
      const db = await h.database();
      assert.equal((await db.db.selectFrom('_cms_auth_credentials').selectAll().execute()).length, 1);
      assert.equal((await db.db.selectFrom('_cms_auth_sessions').selectAll().execute()).length, 0);
      const response = await login(h, state);
      const token = state.browser.cookies.get('cms-session')!;
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      const cookie = response.headers.getSetCookie().find(value => value.startsWith('cms-session='))!;
      assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i); assert.match(cookie, /Secure/i);
      const sessions = await db.db.selectFrom('_cms_auth_sessions').selectAll().execute();
      assert.equal(sessions.length, 1); assert.equal(sessions[0].hash, await hashSessionToken(token));
      assert.notEqual(sessions[0].hash, token);
      assert.equal((await state.browser.query('listSchemaCollections')).envelope.type, 'result');
      const me = await state.browser.get('/api/auth/me?userId=attacker');
      assert.equal(me.status, 200);
      const profile = (await me.json()).data;
      assert.equal(profile.id, state.user.id); assert.equal(profile.email, 'admin@example.com');
      assert.equal(profile.name, 'Real Admin'); assert.equal(profile.role, 50);
      assert.equal(profile.isFirstLogin, true);
      assert.equal((await h.browser().get('/api/auth/me', { 'x-cms-user': state.user.id, 'x-cms-role': '50' })).status, 401);
      await h.restart();
      assert.equal((await state.browser.query('listSchemaCollections')).envelope.type, 'result');
      const reopened = await h.database();
      await reopened.db.updateTable('_cms_auth_users').set({ role: 10 }).where('id', '=', state.user.id).execute();
      const denied = await state.browser.query('listSchemaCollections');
      assert.equal(denied.envelope.status, 403);
      assert.equal((await (await state.browser.get('/api/auth/me')).json()).data.role, 10);
      await reopened.db.updateTable('_cms_auth_users').set({ role: 50, disabled: 1 }).where('id', '=', state.user.id).execute();
      assert.equal((await state.browser.query('listSchemaCollections')).envelope.status, 401);
      assert.equal((await state.browser.get('/api/auth/me')).status, 401);
    } finally { await h.close(); }
  });
  test(`${target}: login rotates predecessor, consumes challenge, and POST logout revokes authority`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const state = await setup(h); await login(h, state);
      const old = state.browser.cookies.get('cms-session')!;
      await login(h, state, 2);
      const next = state.browser.cookies.get('cms-session')!; assert.notEqual(next, old);
      const db = await h.database();
      const sessions = await db.db.selectFrom('_cms_auth_sessions').selectAll().execute();
      assert.equal(sessions.length, 1); assert.equal(sessions[0].hash, await hashSessionToken(next));
      const anonymous = h.browser(); anonymous.cookies.set('cms-session', old);
      assert.equal((await anonymous.query('listSchemaCollections')).envelope.status, 401);
      assert.equal((await h.request('/api/auth/logout')).status, 405);
      const cross = await state.browser.post('/api/auth/logout', {}, 'https://attacker.example');
      assert.equal(cross.status, 403); assert.equal((await state.browser.query('listSchemaCollections')).envelope.type, 'result');
      assert.equal((await state.browser.post('/api/auth/logout', {})).status, 200);
      assert.equal(state.browser.cookies.has('cms-session'), false);
      assert.equal((await db.db.selectFrom('_cms_auth_sessions').selectAll().execute()).length, 0);
      assert.equal((await state.browser.query('listSchemaCollections')).envelope.status, 401);
    } finally { await h.close(); }
  });
  test(`${target}: signed login denies wrong origin/RP/signature, expired/replayed challenges and expired sessions`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const state = await setup(h), db = await h.database();
      for (const overrides of [{ origin: 'https://attacker.example' }, { rpId: 'attacker.example' }, { invalidSignature: true }]) {
        const challenge = (await (await state.browser.post('/api/auth/passkey/options', {})).json()).data.options.challenge;
        const response = await state.browser.post('/api/auth/passkey/verify', { credential: state.credential.assertion(challenge, 1, overrides) });
        assert.equal(response.status, 401); assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
      }
      const expired = (await (await state.browser.post('/api/auth/passkey/options', {})).json()).data.options.challenge;
      await db.db.updateTable('_cms_auth_challenges').set({ expires_at: new Date(0).toISOString() }).where('challenge', '=', expired).execute();
      assert.equal((await state.browser.post('/api/auth/passkey/verify', { credential: state.credential.assertion(expired) })).status, 401);
      const challenge = (await (await state.browser.post('/api/auth/passkey/options', {})).json()).data.options.challenge;
      const payload = { credential: state.credential.assertion(challenge) };
      assert.equal((await state.browser.post('/api/auth/passkey/verify', payload)).status, 200);
      assert.equal((await state.browser.post('/api/auth/passkey/verify', payload)).status, 401);
      assert.equal((await db.db.selectFrom('_cms_auth_sessions').selectAll().execute()).length, 1);
      await db.db.updateTable('_cms_auth_sessions').set({ expires_at: 1 }).execute();
      assert.equal((await state.browser.query('listSchemaCollections')).envelope.status, 401);
    } finally { await h.close(); }
  });
  test(`${target}: setup origin/syntax guards and login challenge throttle run before identity writes`, async () => {
    const h = await passkeyRuntime(target);
    try {
      assert.equal((await h.request('/api/setup/status')).status, 200);
      const browser = h.browser(), db = await h.database();
      assert.equal((await browser.post('/api/setup/admin', { email: 'a@example.com' }, 'https://attacker.example')).status, 403);
      assert.equal((await browser.post('/api/setup/admin', { email: 'invalid' })).status, 400);
      assert.equal((await db.db.selectFrom('_cms_auth_users').selectAll().execute()).length, 0);
      assert.equal((await db.db.selectFrom('_cms_auth_challenges').selectAll().execute()).length, 0);
      for (let i = 0; i < 10; i++) {
        const response = await browser.post('/api/auth/passkey/options', { email: 'unregistered@example.com' });
        assert.equal(response.status, 200); assert.equal((await response.json()).data.options.allowCredentials, undefined);
      }
      const limited = await browser.post('/api/auth/passkey/options', {});
      assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
    } finally { await h.close(); }
  });
}
