// Original fault probes for the immutable EmDash 1.1.0 setup commit boundary.
// Real signed registration, SQL credential-insert fault, persisted restart/retry.
// Zero copied source declaration credit; source/recovery reproduction is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';
import { identityOptions } from '../../src/lib/server/auth/identity-store.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: shared first-credential write fault leaves user and blocks setup retry`, async () => {
    const h = await passkeyRuntime(target);
    try {
      const browser = h.browser(), credential = webauthnCredential(h.origin);
      const begin = await browser.post('/api/setup/admin', { email: 'fault@example.com' });
      assert.equal(begin.status, 200);
      const registration = credential.registration((await begin.json()).data.options.challenge);
      const database = await h.database();
      await sql`CREATE TRIGGER fixture_reject_first_credential BEFORE INSERT ON _cms_auth_credentials
        BEGIN SELECT RAISE(ABORT, 'fixture first credential insert failure'); END`.execute(database.db);
      const failed = await browser.post('/api/setup/admin/verify', { credential: registration });
      assert.equal(failed.status, 500);
      assert.equal((await failed.json()).error.code, 'SETUP_VERIFY_ERROR');
      assert.equal((await database.db.selectFrom('_cms_auth_users').selectAll().execute()).length, 1);
      assert.equal((await database.db.selectFrom('_cms_auth_profiles').selectAll().execute()).length, 1);
      assert.equal((await database.db.selectFrom('_cms_auth_credentials').selectAll().execute()).length, 0);
      assert.equal(await identityOptions(database).get('emdash:setup_complete'), null);
      assert.ok(await identityOptions(database).get('emdash:setup_state'));
      await sql`DROP TRIGGER fixture_reject_first_credential`.execute(database.db);
      await h.restart();
      const restarted = await h.database();
      assert.equal((await restarted.db.selectFrom('_cms_auth_users').selectAll().execute()).length, 1);
      assert.equal((await restarted.db.selectFrom('_cms_auth_credentials').selectAll().execute()).length, 0);
      const status = (await (await browser.get('/api/setup/status')).json()).data;
      assert.equal(status.needsSetup, true);
      assert.equal(status.step, 'admin');
      for (const [path, body] of [
        ['/api/setup/admin', { email: 'fault@example.com' }],
        ['/api/setup/admin/verify', { credential: registration }]
      ] as const) {
        const retry = await browser.post(path, body);
        assert.equal(retry.status, 400);
        assert.equal((await retry.json()).error.code, 'ADMIN_EXISTS');
      }
    } finally { await h.close(); }
  });
}
