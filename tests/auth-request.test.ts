import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_COOKIE_OPTIONS, SESSION_COOKIE_DELETE_OPTIONS, requireSessionMutationOrigin, SessionOriginError } from '../src/lib/server/auth/request.ts';
import { hasPermission, requirePermission, canActOnOwn, PermissionError } from '../src/lib/server/auth/permissions.ts';
import { Role } from '../src/lib/server/auth/roles.ts';

test('local: cookie flags preserve Astro production defaults and deletion scope', () => {
  assert.deepEqual(SESSION_COOKIE_OPTIONS, { path: '/', httpOnly: true, sameSite: 'lax', secure: true });
  assert.deepEqual(SESSION_COOKIE_DELETE_OPTIONS, { ...SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) });
  assert.equal(Object.hasOwn(SESSION_COOKIE_OPTIONS, 'domain'), false);
});
test('local SvelteKit substitution: same-origin session mutations need no custom header', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const request = new Request('http://internal.example/action', { method, headers: { Origin: 'https://cms.example' } });
    assert.doesNotThrow(() => requireSessionMutationOrigin(request, 'https://cms.example'));
  }
});
test('local SvelteKit substitution: custom headers never override a missing or foreign origin', () => {
  for (const origin of [undefined, '', 'null', 'https://evil.example', 'http://cms.example', 'https://cms.example:8443', 'https://cms.example/path', 'https://cms.example@evil.example', 'not-a-url']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const headers = new Headers({ 'X-EmDash-Request': '1', 'X-Forwarded-Host': 'evil.example' });
      if (origin !== undefined) headers.set('Origin', origin);
      const request = new Request('https://cms.example/action', { method, headers });
      assert.throws(() => requireSessionMutationOrigin(request, 'https://cms.example'), SessionOriginError);
    }
  }
});
test('local: safe methods pass origin guard; bad server origin configuration cannot admit mutations', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.doesNotThrow(() => requireSessionMutationOrigin(new Request('https://cms.example', { method }), 'https://cms.example'));
  }
  for (const publicOrigin of ['', 'null', 'file:///tmp', 'https://cms.example/path', 'https://cms.example/', 'https://cms.example@evil.example']) {
    const request = new Request('https://cms.example', { method: 'POST', headers: { Origin: publicOrigin } });
    assert.throws(() => requireSessionMutationOrigin(request, publicOrigin), SessionOriginError);
  }
});
test('local: invalid runtime role and prototype permission keys fail closed', () => {
  for (const role of [0, 49, 51, 100, Infinity, NaN, '50']) {
    assert.equal(hasPermission({ role } as never, 'schema:manage'), false);
  }
  for (const permission of ['constructor', '__proto__', 'content:write', 'does-not-exist']) {
    assert.equal(hasPermission({ role: Role.ADMIN }, permission as never), false);
  }
});
test('local: missing and insufficient principals throw the exact permission error codes', () => {
  assert.throws(() => requirePermission(null, 'content:create'), (error) => error instanceof PermissionError && error.code === 'unauthorized');
  assert.throws(() => requirePermission({ role: Role.SUBSCRIBER }, 'content:create'), (error) => error instanceof PermissionError && error.code === 'forbidden');
  for (const ownerId of [null, '']) {
    assert.equal(canActOnOwn({ id: 'author_1', role: Role.AUTHOR }, ownerId as never, 'content:edit_own', 'content:edit_any'), false);
    assert.equal(canActOnOwn({ id: 'editor_1', role: Role.EDITOR }, ownerId as never, 'content:edit_own', 'content:edit_any'), true);
  }
});
