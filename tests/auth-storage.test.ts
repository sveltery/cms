import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { authSchemaStatements, type AuthTables } from '../src/lib/server/auth/schema.ts';
import { createKyselySessionStore } from '../src/lib/server/auth/store.ts';
import { resolvePrincipal, revokeSession, hashSessionToken } from '../src/lib/server/auth/session.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
import { hasPermission } from '../src/lib/server/auth/permissions.ts';

test('local Node SQLite: empty auth schema creates no account, credential or default admin', async () => {
  const database = openSqlite(':memory:');
  const db = database.db.withTables<AuthTables>();
  try {
    await database.atomicBatch(authSchemaStatements(db));
    assert.deepEqual(await db.selectFrom('_cms_auth_users').selectAll().execute(), []);
    assert.deepEqual(await db.selectFrom('_cms_auth_sessions').selectAll().execute(), []);
    const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    assert.equal(await resolvePrincipal(token, createKyselySessionStore(db)), null);
  } finally { await database.close(); }
});

test('local Node SQLite: current role, disabled/deleted users, expiry and revocation across reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-auth-'));
  const path = join(directory, 'auth.sqlite');
  let database = openSqlite(path);
  let db = database.db.withTables<AuthTables>();
  const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
  const otherToken = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await hashSessionToken(token);
  const otherHash = await hashSessionToken(otherToken);
  assert.ok(hash); assert.ok(otherHash);
  try {
    await database.atomicBatch(authSchemaStatements(db));
    // Explicit test-only insertion; there is no product account/session creation API.
    await db.insertInto('_cms_auth_users').values({ id: 'user_1', role: Role.AUTHOR, disabled: 0 }).execute();
    await db.insertInto('_cms_auth_sessions').values([
      { hash, user_id: 'user_1', expires_at: 1001 },
      { hash: otherHash, user_id: 'user_1', expires_at: 1001 }
    ]).execute();
    let store = createKyselySessionStore(db);
    assert.deepEqual(await resolvePrincipal(token, store, { now: () => 1000 }), { id: 'user_1', role: Role.AUTHOR });
    const persisted = await db.selectFrom('_cms_auth_sessions').selectAll().execute();
    assert.equal(persisted.length, 2);
    assert.ok(persisted.every((row) => row.hash !== token && row.hash !== otherToken));
    assert.equal(await resolvePrincipal(token, store, { now: () => 1001 }), null);
    assert.equal((await db.selectFrom('_cms_auth_sessions').selectAll().execute())[0].expires_at, 1001);
    await database.close();
    database = openSqlite(path); db = database.db.withTables<AuthTables>(); store = createKyselySessionStore(db);
    assert.deepEqual(await resolvePrincipal(token, store, { now: () => 1000 }), { id: 'user_1', role: Role.AUTHOR });
    await db.updateTable('_cms_auth_users').set({ role: Role.SUBSCRIBER }).where('id', '=', 'user_1').execute();
    const subscriber = await resolvePrincipal(token, store, { now: () => 1000 });
    assert.deepEqual(subscriber, { id: 'user_1', role: Role.SUBSCRIBER });
    assert.equal(hasPermission(subscriber, 'content:read_drafts'), false);
    assert.equal(hasPermission(subscriber, 'content:create'), false);
    await db.updateTable('_cms_auth_users').set({ disabled: 1 }).where('id', '=', 'user_1').execute();
    assert.equal(await resolvePrincipal(token, store, { now: () => 1000 }), null);
    await db.updateTable('_cms_auth_users').set({ disabled: 0 }).where('id', '=', 'user_1').execute();
    await revokeSession(token, store);
    await revokeSession(token, store);
    assert.equal(await resolvePrincipal(token, store, { now: () => 1000 }), null);
    assert.ok(await resolvePrincipal(otherToken, store, { now: () => 1000 }));
    assert.equal((await db.selectFrom('_cms_auth_sessions').selectAll().execute()).length, 1);
    await database.close();
    database = openSqlite(path); db = database.db.withTables<AuthTables>(); store = createKyselySessionStore(db);
    assert.equal(await resolvePrincipal(token, store, { now: () => 1000 }), null);
    assert.ok(await resolvePrincipal(otherToken, store, { now: () => 1000 }));
    await db.deleteFrom('_cms_auth_users').where('id', '=', 'user_1').execute();
    assert.equal(await resolvePrincipal(otherToken, store, { now: () => 1000 }), null);
  } finally { await database.close(); await rm(directory, { recursive: true, force: true }); }
});
