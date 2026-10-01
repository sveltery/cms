// Synthetic portable-core acceptance harness. No deployed route or storage adapter is defined here.
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { resolveSessionUser, resolvePrincipal, hashSessionToken, revokeSession, type SessionSnapshot, type SessionStore } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';
import { hasPermission, canActOnOwn } from '../../src/lib/server/auth/permissions.ts';
import { requireSessionMutationOrigin, SESSION_COOKIE_OPTIONS } from '../../src/lib/server/auth/request.ts';

export default {
  async fetch(_request: Request, _env: unknown, ctx: { waitUntil(task: Promise<void>): void }) {
    const passed: string[] = [];
    const check = (name: string, condition: boolean) => {
      if (!condition) throw new Error(name);
      passed.push(name);
    };
    let key: string | undefined;
    check('source: resolved session user and user-key lookup', JSON.stringify(await resolveSessionUser({ async get(value) { key = value; return { id: 'user_1' }; } })) === '{"id":"user_1"}' && key === 'user');
    check('source: missing session', await resolveSessionUser(undefined) === undefined);
    check('source: stalled session', await resolveSessionUser({ get: () => new Promise(() => {}) }, 20) === undefined);
    check('source: rejected session', await resolveSessionUser({ get: () => Promise.reject(new Error('boom')) }, 20) === undefined);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = encodeBase64urlNoPadding(bytes);
    const expected = encodeBase64urlNoPadding(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    check('local: upstream-compatible SHA-256 hash', await hashSessionToken(token) === expected);
    let snapshot: SessionSnapshot | null = { user: { id: 'user_1', role: Role.AUTHOR, disabled: false }, expiresAt: 1001 };
    const hashes: string[] = [];
    const store: SessionStore = {
      async read(hash) { hashes.push(hash); return snapshot; },
      async revoke(hash) { hashes.push(hash); snapshot = null; }
    };
    let anchors = 0;
    const principal = await resolvePrincipal(token, store, { now: () => 1000, keepAlive(task) { anchors++; ctx.waitUntil(task); } });
    check('local: trusted minimal principal and request waitUntil', JSON.stringify(principal) === '{"id":"user_1","role":30}' && anchors === 1 && hashes[0] === expected);
    check('source: author owns content', canActOnOwn({ role: Role.AUTHOR, id: 'user-1' }, 'user-1', 'content:edit_own', 'content:edit_any'));
    check('source: author cannot edit others', !canActOnOwn({ role: Role.AUTHOR, id: 'user-1' }, 'user-2', 'content:edit_own', 'content:edit_any'));
    check('local: null ownership denial', !canActOnOwn(principal, null as never, 'content:edit_own', 'content:edit_any'));
    check('local: exact expiry', await resolvePrincipal(token, store, { now: () => 1001 }) === null);
    snapshot = { user: { id: 'user_1', role: Role.SUBSCRIBER, disabled: false }, expiresAt: 1001 };
    const subscriber = await resolvePrincipal(token, store, { now: () => 1000 });
    check('local: current role demotion', subscriber?.role === Role.SUBSCRIBER && !hasPermission(subscriber, 'content:create') && !hasPermission(subscriber, 'content:read_drafts'));
    snapshot.user.disabled = true;
    check('local: disabled user denial', await resolvePrincipal(token, store, { now: () => 1000 }) === null);
    snapshot.user.disabled = false;
    await revokeSession(token, store);
    check('local: revocation', await resolvePrincipal(token, store, { now: () => 1000 }) === null);
    const lookups = hashes.length;
    check('local: role-cookie injection denial', await resolvePrincipal('{"id":"user_1","role":50}', store) === null && hashes.length === lookups);
    requireSessionMutationOrigin(new Request('https://cms.example', { method: 'POST', headers: { Origin: 'https://cms.example' } }), 'https://cms.example');
    let denied = false;
    try { requireSessionMutationOrigin(new Request('https://cms.example', { method: 'POST', headers: { Origin: 'https://evil.example', 'X-EmDash-Request': '1' } }), 'https://cms.example'); }
    catch { denied = true; }
    check('local: origin denial and cookie flags', denied && SESSION_COOKIE_OPTIONS.httpOnly && SESSION_COOKIE_OPTIONS.secure && SESSION_COOKIE_OPTIONS.sameSite === 'lax');
    return Response.json({ passed });
  }
};
