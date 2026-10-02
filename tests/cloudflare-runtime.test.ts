// Supplemental native integration assertions, zero upstream assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../src/lib/server/runtime/composition.ts';
import { runtimeConfiguration } from '../src/lib/server/runtime/environment.ts';

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
