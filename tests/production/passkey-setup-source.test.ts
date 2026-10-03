// Assertion ports/adaptations from EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/tests/integration/astro/setup-admin-nonce.test.ts
// Real Kit HTTP, database namespace and native cookie parsing replace Astro context fixtures.
// Cookie path '/' is a supplemental transport expectation, not the source '/_emdash/' assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { passkeyRemotes } from '../helpers/passkey-remotes.ts';

const adminBody = { email: 'real@admin.example', name: 'Real Admin' };
const attackerBody = { email: 'attacker@evil.example', name: 'Attacker' };
const bogusCredential = { credential: { id: 'AA', rawId: 'AA', type: 'public-key',
  response: { clientDataJSON: 'AA', attestationObject: 'AA' } } };
const startPath = '/api/setup/admin';
const verifyPath = '/api/setup/admin/verify';
async function state(h: Awaited<ReturnType<typeof passkeyRemotes>>) {
  const result = await sql<{ value: string }>`SELECT value FROM _cms_auth_setup WHERE key = 'emdash:setup_state'`.execute(h.database.db);
  return result.rows[0] ? JSON.parse(result.rows[0].value) : null;
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: source nonce: sets HttpOnly nonce cookie and stores setup state`, async () => {
    const h = await passkeyRemotes(target);
    try {
      const browser = h.browser();
      const response = await browser.post(startPath, adminBody);
      assert.equal(response.status, 200);
      const cookie = browser.cookies.get('emdash_setup_nonce');
      assert.ok(cookie);
      assert.match(cookie.value, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(cookie.options.httponly, true);
      assert.equal(String(cookie.options.samesite).toLowerCase(), 'strict');
      assert.equal(cookie.options.path, '/'); // Kit/root-route adaptation: no source expression credit.
      const setupState = await state(h);
      assert.ok(setupState);
      assert.equal(setupState.email, 'real@admin.example');
      assert.equal(setupState.nonce, cookie.value);
    } finally { await h.close(); }
  });
  test(`${target}: source nonce: public HTTPS sets Secure behind an internal HTTP request`, async () => {
    const h = await passkeyRemotes(target, 'https://public.example.com');
    try {
      const browser = h.browser();
      assert.equal((await browser.post(startPath, adminBody)).status, 200);
      const cookie = browser.cookies.get('emdash_setup_nonce');
      assert.ok(cookie);
      assert.equal(cookie.options.secure, true);
    } finally { await h.close(); }
  });
  test(`${target}: source nonce: public HTTP omits Secure for local development`, async () => {
    const h = await passkeyRemotes(target);
    try {
      const browser = h.browser();
      assert.equal((await browser.post(startPath, adminBody)).status, 200);
      const cookie = browser.cookies.get('emdash_setup_nonce');
      assert.ok(cookie);
      assert.equal(cookie.options.secure ?? false, false);
    } finally { await h.close(); }
  });
  test(`${target}: source nonce: verify rejects no cookie`, async () => {
    const h = await passkeyRemotes(target);
    try {
      assert.equal((await h.browser().post(startPath, adminBody)).status, 200);
      const response = await h.browser().post(verifyPath, bogusCredential);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error?.code, 'INVALID_STATE');
    } finally { await h.close(); }
  });
  test(`${target}: source nonce: verify rejects a mismatching cookie`, async () => {
    const h = await passkeyRemotes(target);
    try {
      assert.equal((await h.browser().post(startPath, adminBody)).status, 200);
      const browser = h.browser({ emdash_setup_nonce: 'obviously-wrong-value' });
      const response = await browser.post(verifyPath, bogusCredential);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error?.code, 'INVALID_STATE');
    } finally { await h.close(); }
  });
  test(`${target}: source nonce: rotating state prevents email-hijack verification`, async () => {
    const h = await passkeyRemotes(target);
    try {
      const operator = h.browser();
      assert.equal((await operator.post(startPath, adminBody)).status, 200);
      const operatorNonce = operator.cookies.get('emdash_setup_nonce')!.value;
      const attacker = h.browser();
      assert.equal((await attacker.post(startPath, attackerBody)).status, 200);
      assert.notEqual(attacker.cookies.get('emdash_setup_nonce')!.value, operatorNonce);
      const response = await operator.post(verifyPath, bogusCredential);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error?.code, 'INVALID_STATE');
    } finally { await h.close(); }
  });
  test(`${target}: source nonce: same-browser retry rotates cookie and persists latest state`, async () => {
    const h = await passkeyRemotes(target);
    try {
      const browser = h.browser();
      assert.equal((await browser.post(startPath, adminBody)).status, 200);
      const nonceA = browser.cookies.get('emdash_setup_nonce')!.value;
      assert.equal((await browser.post(startPath, adminBody)).status, 200);
      const nonceB = browser.cookies.get('emdash_setup_nonce')!.value;
      assert.notEqual(nonceB, nonceA);
      assert.equal((await state(h)).nonce, nonceB);
    } finally { await h.close(); }
  });
}
