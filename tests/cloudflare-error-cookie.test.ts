// Supplemental throwing native-runtime/real-Kit-cookie boundary, zero source parity credit.
// Ordinary Kit route errors can return a Response instead; this does not claim whole-Worker error coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../src/lib/server/runtime/composition.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { hashSessionToken } from '../src/lib/server/auth/session.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
const { get_cookies, add_cookies_to_headers } = await import(new URL('../node_modules/@sveltejs/kit/src/runtime/server/cookie.js', import.meta.url).href);

for (const invalidateSetter of [false, true]) {
  test(`throwing native resolve preserves its completed D1 write bookmark in Kit's outer error response (${invalidateSetter})`, { timeout: 30_000 }, async () => {
    const worker = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("fixture")}}', compatibilityDate: '2026-05-07', d1Databases: { CMS_DB: 'cms-error-cookie-proof' }, cf: false });
    const binding = await worker.getD1Database('CMS_DB');
    const runtime = createCmsRuntime(() => ({ kind: 'd1', binding, publicOrigin: 'https://cms.example', d1: { binding: 'CMS_DB', session: 'auto', coalesce: true } }));
    const operator = openD1(binding);
    function fixture(token?: string) {
      const request = new Request('https://cms.example/', { method: token ? 'POST' : 'GET', headers: token ? { cookie: `cms-session=${token}` } : {} });
      const jar = get_cookies(request, new URL(request.url));
      jar.set_trailing_slash('never');
      return { event: { request, url: new URL(request.url), locals: {}, cookies: jar.cookies } as unknown as RequestEvent, jar };
    }
    try {
      await runtime.handle({ event: fixture().event, resolve: async () => new Response('ready') });
      const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
      await operator.db.insertInto('_cms_auth_users').values({ id: 'error-cookie-owner', role: Role.AUTHOR, disabled: 0 }).execute();
      await operator.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'error-cookie-owner', expires_at: Date.now() + 60_000 }).execute();
      const f = fixture(token);
      const original = new Error('original render failure');
      await assert.rejects(async () => runtime.handle({ event: f.event, resolve: async event => {
        assert.equal(event.locals.cms!.principal!.id, 'error-cookie-owner');
        event.cookies.set('other-cookie', 'preserved', { path: '/' });
        await event.locals.cms!.database.db.insertInto('_cms_auth_users').values({ id: 'committed-before-error', role: Role.SUBSCRIBER, disabled: 0 }).execute();
        if (invalidateSetter) {
          // Kit resolve's finally replaces the public setter; the saved jar setter
          // must still hand cookies to the outer fatal-error response.
          event.cookies.set = () => { throw new Error('Cannot use cookies.set after the response has been generated'); };
        }
        throw original;
      } }), (cause: unknown) => cause === original);
      assert.ok(await operator.db.selectFrom('_cms_auth_users').select('id').where('id', '=', 'committed-before-error').executeTakeFirst());
      const errorResponse = new Response('error body', { status: 500, headers: { 'x-error-header': 'preserved' } });
      add_cookies_to_headers(errorResponse.headers, f.jar.new_cookies.values());
      assert.equal(errorResponse.status, 500);
      assert.equal(await errorResponse.text(), 'error body');
      assert.equal(errorResponse.headers.get('x-error-header'), 'preserved');
      assert.match(errorResponse.headers.get('set-cookie') ?? '', /other-cookie=preserved/);
      assert.match(errorResponse.headers.get('set-cookie') ?? '', /__em_d1_bookmark=.+Path=\/.+HttpOnly.+Secure.+SameSite=Lax/);
    } finally { await operator.close(); await runtime.close(); await worker.dispose(); }
  });
}
