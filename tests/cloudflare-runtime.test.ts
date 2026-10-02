// Supplemental native integration assertions, zero upstream assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../src/lib/server/runtime/composition.ts';
import { runtimeConfiguration } from '../src/lib/server/runtime/environment.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { hashSessionToken } from '../src/lib/server/auth/session.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';

test('native D1 runtime scopes each request and commits its authenticated bookmark', { timeout: 30_000 }, async () => {
  const worker = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("fixture")}}', compatibilityDate: '2026-05-07', d1Databases: { CMS_DB: 'cms-cloudflare-scope' }, cf: false });
  const realBinding = await worker.getD1Database('CMS_DB');
  const constraints: string[] = [];
  const binding = {
    prepare: realBinding.prepare.bind(realBinding), batch: realBinding.batch.bind(realBinding),
    withSession(constraint?: string) { constraints.push(constraint ?? ''); return realBinding.withSession(constraint); }
  };
  const runtime = createCmsRuntime(() => ({ kind: 'd1', binding, publicOrigin: 'https://cms.example', d1: { binding: 'CMS_DB', session: 'auto', coalesce: true } } as never));
  const cookies = new Map<string, string>();
  const event = { request: new Request('https://cms.example/'), url: new URL('https://cms.example/'), locals: {}, cookies: { get: (name: string) => cookies.get(name), set: (name: string, value: string) => cookies.set(name, value), serialize: (name: string, value: string) => `${name}=${value}; Path=/; HttpOnly; Secure` } } as unknown as RequestEvent;
  try {
    const response = await runtime.handle({ event, resolve: async request => {
      await request.locals.cms!.database.db.selectFrom('_cms_migrations').select('version').execute();
      // A successful native auth endpoint sets an ordinary opaque session cookie.
      request.cookies.set('cms-session', 'new-opaque-session', { path: '/' });
      return new Response('ok');
    } });
    assert.deepEqual(constraints, ['first-unconstrained']);
    assert.match(response.headers.get('set-cookie') ?? '', /__em_d1_bookmark=.+HttpOnly/);
  } finally { await runtime.close(); await worker.dispose(); }
});

test('Cloudflare host settings use the trusted binding configuration for D1 Sessions', () => {
  const binding = { prepare() {}, batch() {} };
  const config = runtimeConfiguration({}, { env: { CMS_DB: binding, CMS_PUBLIC_ORIGIN: 'https://cms.example', SVELTERY_D1_SESSION: 'auto', SVELTERY_D1_COALESCE: 'true', SVELTERY_MUTATIONS_ENABLED: 'false' } });
  assert.equal(config!.mutationsEnabled, false);
  assert.deepEqual((config as any).d1, { binding: 'CMS_DB', session: 'auto', coalesce: true });
});

test('real D1 authenticates on raw storage before scoping and applies write/bookmark constraints', { timeout: 30_000 }, async () => {
  const worker = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("fixture")}}', compatibilityDate: '2026-05-07', d1Databases: { CMS_DB: 'cms-cloudflare-auth-scope' }, cf: false });
  const realBinding = await worker.getD1Database('CMS_DB');
  const operations: string[] = [];
  const binding = {
    prepare(sql: string) { operations.push(`raw:${sql}`); return realBinding.prepare(sql); },
    batch: realBinding.batch.bind(realBinding),
    withSession(constraint?: string) { operations.push(`session:${constraint}`); return realBinding.withSession(constraint); }
  };
  const runtime = createCmsRuntime(() => ({ kind: 'd1', binding, publicOrigin: 'https://cms.example', d1: { binding: 'CMS_DB', session: 'auto' } } as never));
  const event = (method: string, session?: string, bookmark?: string) => ({
    request: new Request('https://cms.example/', { method }), url: new URL('https://cms.example/'), locals: {},
    cookies: {
      get: (name: string) => name === 'cms-session' ? session : name === '__em_d1_bookmark' ? bookmark : undefined,
      set() {}, serialize: (name: string, value: string, options: Record<string, unknown>) => {
        assert.deepEqual(options, { path: '/', httpOnly: true, sameSite: 'lax', secure: true });
        return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure`;
      }
    }
  } as unknown as RequestEvent);
  const resolve = async (request: RequestEvent) => {
    await request.locals.cms!.database.db.selectFrom('_cms_migrations').select('version').execute();
    return new Response('ok', { headers: { 'set-cookie': 'existing=value; Path=/' } });
  };
  const operator = openD1(realBinding);
  try {
    // Concurrent first requests must settle canonical startup without duplicate markers.
    const initial = await Promise.all(Array.from({ length: 4 }, () => runtime.handle({ event: event('GET'), resolve })));
    assert.ok(initial.every(response => !response.headers.get('set-cookie')!.includes('__em_d1_bookmark')));
    const versions = await operator.db.selectFrom('_cms_migrations').select('version').execute();
    assert.equal(new Set(versions.map(row => row.version)).size, versions.length);
    assert.ok(versions.some(row => row.version === 4));
    const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    await operator.db.insertInto('_cms_auth_users').values({ id: 'scope-owner', role: Role.AUTHOR, disabled: 0 }).execute();
    await operator.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'scope-owner', expires_at: Date.now() + 60_000 }).execute();
    operations.length = 0;
    const resumed = await runtime.handle({ event: event('GET', token, 'opaque-saved-bookmark'), resolve });
    const scopeIndex = operations.indexOf('session:opaque-saved-bookmark');
    assert.ok(scopeIndex > 0);
    assert.ok(operations.slice(0, scopeIndex).some(operation => operation.includes('_cms_auth_sessions')));
    assert.match(resumed.headers.get('set-cookie')!, /existing=value/);
    assert.match(resumed.headers.get('set-cookie')!, /__em_d1_bookmark=.+HttpOnly; SameSite=Lax; Secure/);
    operations.length = 0;
    await runtime.handle({ event: event('POST', token, 'opaque-saved-bookmark'), resolve });
    assert.ok(operations.includes('session:first-primary'));
    for (const bookmark of ['bad\nbookmark', 'x'.repeat(1025)]) {
      operations.length = 0;
      await runtime.handle({ event: event('GET', token, bookmark), resolve });
      assert.ok(operations.includes('session:first-unconstrained'));
    }
    operations.length = 0;
    const anonymous = await runtime.handle({ event: event('GET', undefined, 'opaque-saved-bookmark'), resolve });
    assert.ok(operations.includes('session:first-unconstrained'));
    assert.ok(!anonymous.headers.get('set-cookie')!.includes('__em_d1_bookmark'));
  } finally { await operator.close(); await runtime.close(); await worker.dispose(); }
});
