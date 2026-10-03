// Original actual official-Worker/D1 integration, zero copied source credit.
// Real signed setup/login and persisted restart; no identity/session seeds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';

test('official Cloudflare Worker registers, authenticates and revokes real persisted passkey identity', { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-worker-passkey-'));
  const scriptPath = resolve('build/cloudflare/worker/worker.js');
  const origin = 'https://cms.example', credential = webauthnCredential(origin);
  const cookies = new Map<string, string>();
  function start() {
    return new Miniflare({ modulesRoot: dirname(scriptPath), modules: [{ type: 'ESModule', path: scriptPath }],
      compatibilityDate: '2026-05-07', compatibilityFlags: ['nodejs_compat'], cf: false,
      assets: { directory: resolve('build/cloudflare/assets'), binding: 'ASSETS',
        routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } },
      d1Persist: directory, d1Databases: { CMS_DB: 'cms-passkey-worker-d1' },
      bindings: { CMS_PUBLIC_ORIGIN: origin, SVELTERY_D1_SESSION: 'auto', SVELTERY_D1_COALESCE: 'true' } });
  }
  let worker = start();
  async function request(path: string, body?: unknown) {
    const headers = new Headers({ origin, 'cf-connecting-ip': '127.0.0.1' });
    if (cookies.size) headers.set('cookie', [...cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    if (body !== undefined) headers.set('content-type', 'application/json');
    const response = await worker.dispatchFetch(`${origin}${path}`, { headers,
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'), index = pair.indexOf('=');
      if (/max-age=0(?:;|$)/i.test(cookie)) cookies.delete(pair.slice(0, index));
      else cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  try {
    assert.equal((await request('/api/auth/me')).status, 401);
    const begin = await request('/api/setup/admin', { email: 'worker-passkey@example.com', name: 'Worker administrator' });
    assert.equal(begin.status, 200);
    const registration = credential.registration((await begin.json()).data.options.challenge);
    const complete = await request('/api/setup/admin/verify', { credential: registration });
    assert.equal(complete.status, 200);
    assert.equal((await request('/api/auth/me')).status, 401);
    const options = await request('/api/auth/passkey/options', {});
    assert.equal(options.status, 200);
    const login = await request('/api/auth/passkey/verify', { credential: credential.assertion((await options.json()).data.options.challenge) });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie') ?? '', /cms-session=.+HttpOnly/i);
    assert.match(login.headers.get('set-cookie') ?? '', /__em_d1_bookmark=.+HttpOnly/i);
    const user = (await (await request('/api/auth/me')).json()).data;
    assert.equal(user.email, 'worker-passkey@example.com');
    const binding = await worker.getD1Database('CMS_DB');
    assert.equal((await binding.prepare('SELECT count(*) AS count FROM _cms_auth_users').first<{ count: number }>())?.count, 1);
    assert.equal((await binding.prepare('SELECT count(*) AS count FROM _cms_auth_credentials').first<{ count: number }>())?.count, 1);
    const session = cookies.get('cms-session');
    await worker.dispose(); worker = start();
    assert.equal((await (await request('/api/auth/me')).json()).data.id, user.id);
    assert.equal((await (await request('/api/setup/status')).json()).data.needsSetup, false);
    assert.equal((await request('/api/auth/logout', {})).status, 200);
    assert.equal(cookies.has('cms-session'), false);
    assert.equal((await request('/api/auth/me')).status, 401);
    // Replaying the genuinely issued token must observe persisted revocation.
    cookies.set('cms-session', session!);
    assert.equal((await request('/api/auth/me')).status, 401);
  } finally { await worker.dispose(); await rm(directory, { recursive: true, force: true }); }
});
