// EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Exact four resolver ports: 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/tests/unit/astro/session-user.test.ts:11,17,23,30.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { resolveSessionUser, resolvePrincipal, hashSessionToken, revokeSession, type SessionStore, type SessionSnapshot } from '../src/lib/server/auth/session.ts';
import { Role } from '../src/lib/server/auth/roles.ts';

// Synthetic credentials exist only in test memory, generated separately for every fixture.
export function syntheticToken() { return encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32))); }
function fixture() {
  const token = syntheticToken();
  let snapshot: SessionSnapshot | null = { user: { id: 'user_1', role: Role.AUTHOR, disabled: false }, expiresAt: 1001 };
  const hashes: string[] = [];
  const store: SessionStore = { async read(hash) { hashes.push(hash); return snapshot; }, async revoke(hash) { hashes.push(hash); snapshot = null; } };
  return { token, store, hashes, set(value: SessionSnapshot | null) { snapshot = value; } };
}

test('returns the session user when the read resolves [session-user.test.ts:11]', async () => {
  const calls: string[] = [];
  const session = { async get(key: 'user') { calls.push(key); return { id: 'user_1' }; } };
  assert.deepEqual(await resolveSessionUser(session), { id: 'user_1' });
  assert.deepEqual(calls, ['user']);
});
test('returns undefined when there is no session [session-user.test.ts:17]', async () => {
  assert.equal(await resolveSessionUser(undefined), undefined);
});
test('falls back to undefined instead of hanging when the read never settles [session-user.test.ts:23]', { timeout: 1000 }, async () => {
  const session = { get: () => new Promise<{ id: string }>(() => {}) };
  assert.equal(await resolveSessionUser(session, 20), undefined);
});
test('fails closed to undefined when the read rejects [session-user.test.ts:30]', async () => {
  const session = { get: () => Promise.reject(new Error('boom')) };
  assert.equal(await resolveSessionUser(session, 20), undefined);
});

test('local: resolver catches synchronous throws and anchors pending reads', async () => {
  assert.equal(await resolveSessionUser({ get() { throw new Error('boom'); } }, 20), undefined);
  const tasks: Promise<void>[] = [];
  assert.deepEqual(await resolveSessionUser({ async get() { return { id: 'user_1' }; } }, 20, (task) => { tasks.push(task); }), { id: 'user_1' });
  assert.equal(tasks.length, 1);
  await tasks[0];
});
test('local: SHA-256 hashes decoded token bytes with the upstream encoding', async () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = encodeBase64urlNoPadding(bytes);
  const expected = encodeBase64urlNoPadding(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  assert.equal(await hashSessionToken(token), expected);
  assert.notEqual(expected, token);
});
test('local: session resolution returns only a frozen current database identity and role', async () => {
  const f = fixture();
  const principal = await resolvePrincipal(f.token, f.store, { now: () => 1000 });
  assert.deepEqual(principal, { id: 'user_1', role: Role.AUTHOR });
  assert.equal(Object.isFrozen(principal), true);
  assert.deepEqual(f.hashes, [await hashSessionToken(f.token)]);
  assert.notEqual(f.hashes[0], f.token);
});
test('local: no cookie/store and malformed cookies incur zero storage calls', async () => {
  const f = fixture();
  for (const token of [undefined, null, '', 'role=50', JSON.stringify({ id: 'user_1', role: 50 }), f.token + '=', 'a'.repeat(4096), '!'.repeat(43)]) {
    assert.equal(await resolvePrincipal(token, f.store), null);
  }
  assert.equal(await resolvePrincipal(f.token, undefined), null);
  assert.deepEqual(f.hashes, []);
});
test('local: expiry denies at and beyond the exact boundary without renewal', async () => {
  const f = fixture();
  assert.deepEqual(await resolvePrincipal(f.token, f.store, { now: () => 1000 }), { id: 'user_1', role: Role.AUTHOR });
  assert.equal(await resolvePrincipal(f.token, f.store, { now: () => 1001 }), null);
  assert.equal(await resolvePrincipal(f.token, f.store, { now: () => 1002 }), null);
  assert.deepEqual(await resolvePrincipal(f.token, f.store, { now: () => 1000 }), { id: 'user_1', role: Role.AUTHOR });
});
test('local: missing, disabled and invalid records all deny', async () => {
  const f = fixture();
  for (const snapshot of [null,
    { user: { id: '', role: 50, disabled: false }, expiresAt: 1001 },
    { user: { id: 'user_1', role: 100, disabled: false }, expiresAt: 1001 },
    { user: { id: 'user_1', role: 50, disabled: true }, expiresAt: 1001 },
    { user: { id: 'user_1', role: 50, disabled: false }, expiresAt: NaN },
    { user: { id: 'user_1', role: 50, disabled: false }, expiresAt: Infinity }]) {
    f.set(snapshot); assert.equal(await resolvePrincipal(f.token, f.store, { now: () => 1000 }), null);
  }
  f.set({ user: { id: 'user_1', role: 30, disabled: false }, expiresAt: 1001 });
  assert.equal(await resolvePrincipal(f.token, f.store, { now: () => 1001 }), null);
});
test('local: current role changes are observed on every resolution', async () => {
  const f = fixture();
  assert.deepEqual(await resolvePrincipal(f.token, f.store, { now: () => 1000 }), { id: 'user_1', role: Role.AUTHOR });
  f.set({ user: { id: 'user_1', role: Role.SUBSCRIBER, disabled: false }, expiresAt: 1001 });
  assert.deepEqual(await resolvePrincipal(f.token, f.store, { now: () => 1000 }), { id: 'user_1', role: Role.SUBSCRIBER });
});
test('local: revocation invalidates the same credential and is idempotent', async () => {
  const f = fixture();
  assert.ok(await resolvePrincipal(f.token, f.store, { now: () => 1000 }));
  await revokeSession(f.token, f.store);
  await revokeSession(f.token, f.store);
  assert.equal(await resolvePrincipal(f.token, f.store, { now: () => 1000 }), null);
  assert.ok(f.hashes.every((value) => value !== f.token));
});
test('local: failed revocation propagates, while failed/stalled resolution denies', { timeout: 1000 }, async () => {
  const f = fixture();
  const failure: SessionStore = { async read() { throw new Error('unavailable'); }, async revoke() { throw new Error('unavailable'); } };
  assert.equal(await resolvePrincipal(f.token, failure, { timeoutMs: 20 }), null);
  assert.equal(await resolvePrincipal(f.token, { ...failure, read: () => new Promise(() => {}) }, { timeoutMs: 20 }), null);
  await assert.rejects(revokeSession(f.token, failure), /unavailable/);
});

test('local: a session that expires while its store read is pending cannot authenticate', async () => {
  const f = fixture();
  let clock = 1000;
  let release!: (snapshot: SessionSnapshot) => void;
  let started!: () => void;
  const readStarted = new Promise<void>((resolve) => { started = resolve; });
  const store: SessionStore = {
    read() { started(); return new Promise((resolve) => { release = resolve; }); },
    async revoke() {}
  };
  const resolving = resolvePrincipal(f.token, store, { now: () => clock });
  await readStarted;
  clock = 1001;
  release({ user: { id: 'user_1', role: Role.AUTHOR, disabled: false }, expiresAt: 1001 });
  assert.equal(await resolving, null);
});
