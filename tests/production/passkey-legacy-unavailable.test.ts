// Original native upgrade-availability checks, zero copied source credit.
// Minimal pre-existing users remain untouched; mixed profiles come only from
// genuine setup. No profile/credential backfill or enrollment is fabricated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';
import { identityOptions } from '../../src/lib/server/auth/identity-store.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

const success = z.object({ success: z.literal(true), data: z.record(z.string(), z.unknown()) });
const failure = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });
async function snapshot(database: CmsDatabase) {
  return Promise.all([
    database.db.selectFrom('_cms_auth_users').selectAll().orderBy('id').execute(),
    database.db.selectFrom('_cms_auth_profiles').selectAll().orderBy('user_id').execute(),
    database.db.selectFrom('_cms_auth_credentials').selectAll().orderBy('id').execute(),
    database.db.selectFrom('_cms_auth_sessions').selectAll().orderBy('hash').execute(),
    database.db.selectFrom('_cms_auth_setup').selectAll().orderBy('key').execute(),
    database.db.selectFrom('_cms_auth_challenges').selectAll().orderBy('challenge').execute(),
    database.db.selectFrom('_cms_auth_rate_limits').selectAll().orderBy('key').execute()
  ]);
}
async function fixture(target: 'Node' | 'D1', complete: boolean, mixed = false) {
  const h = await passkeyRuntime(target), browser = h.browser();
  try {
    assert.equal((await browser.get('/api/setup/status')).status, 200);
    if (mixed) {
      const credential = webauthnCredential(h.origin);
      const begun = await browser.post('/api/setup/admin', { email: 'enrolled@example.com' });
      assert.equal(begun.status, 200);
      const data = z.object({ data: z.object({ options: z.object({ challenge: z.string() }) }) }).parse(await begun.json());
      assert.equal((await browser.post('/api/setup/admin/verify', { credential: credential.registration(data.data.options.challenge) })).status, 200);
    }
    const database = await h.database();
    await database.db.insertInto('_cms_auth_users').values({ id: 'preexisting-minimal-user', role: 50, disabled: 0 }).execute();
    // Dummy historical storage metadata only; no valid cookie or session issuance.
    await database.db.insertInto('_cms_auth_sessions').values({ hash: 'dummy-preexisting-stored-hash',
      user_id: 'preexisting-minimal-user', expires_at: Date.now() + 60_000 }).execute();
    if (complete) await identityOptions(database).set('emdash:setup_complete', true);
    else await identityOptions(database).delete('emdash:setup_complete');
    return { h, browser, database };
  } catch (cause) { await h.close(); throw cause; }
}

for (const target of ['Node', 'D1'] as const) {
  for (const complete of [false, true]) {
    for (const mixed of [false, true]) {
      test(`${target}: profileless legacy availability is explicit with complete=${complete}, mixed=${mixed}`, async () => {
        const { h, browser, database } = await fixture(target, complete, mixed);
        try {
          const before = await snapshot(database);
          const response = await browser.get('/api/setup/status');
          assert.equal(response.status, 200);
          assert.deepEqual(success.parse(await response.json()).data, {
            needsSetup: false, unavailable: true, reason: 'LEGACY_IDENTITY_UNAVAILABLE'
          });
          assert.deepEqual(await snapshot(database), before);
        } finally { await h.close(); }
      });
    }
  }
  test(`${target}: JSON and native setup/login starts reject before changing legacy storage`, async () => {
    const { h, browser, database } = await fixture(target, false);
    try {
      const before = await snapshot(database);
      for (const [path, body] of [['/api/setup/admin', { email: 'ignored@example.com' }],
        ['/api/setup/admin/verify', { credential: {} }], ['/api/auth/passkey/options', {}]] as const) {
        const response = await browser.post(path, body);
        assert.equal(response.status, 503);
        assert.equal(failure.parse(await response.json()).error.code, 'LEGACY_IDENTITY_UNAVAILABLE');
      }
      for (const [name, fields] of [['beginSetup', { email: 'ignored@example.com' }], ['beginLogin', {}]] as const) {
        const response = await h.request(`/_app/remote/${h.ids[name]}`, { method: 'POST',
          headers: { origin: h.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) });
        assert.equal(response.status, 200);
        const result = z.object({ status: z.literal(503), error: z.object({ code: z.literal('LEGACY_IDENTITY_UNAVAILABLE') }) }).parse(await response.json());
        assert.equal(result.status, 503);
      }
      assert.deepEqual(await snapshot(database), before);
    } finally { await h.close(); }
  });
  test(`${target}: setup/login pages hide unavailable legacy controls`, async () => {
    const { h, browser, database } = await fixture(target, false);
    try {
      const before = await snapshot(database);
      for (const path of ['/setup', '/login']) {
        const response = await browser.get(path);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /Passkey authentication is unavailable for existing accounts/);
        assert.doesNotMatch(html, /<form[^>]*action="[^"]*\/(?:beginSetup|beginLogin)/);
        assert.doesNotMatch(html, /Set up your administrator account first/);
      }
      assert.deepEqual(await snapshot(database), before);
    } finally { await h.close(); }
  });
}
