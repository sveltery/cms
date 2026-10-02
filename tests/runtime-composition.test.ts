// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source assertions: EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e,
// packages/core/tests/unit/db/sqlite.test.ts:25 (WAL and synchronous rows).
// Hosting, setup, auth and framework checks below are supplemental.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sql } from 'kysely';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../src/lib/server/runtime/composition.ts';
import { runtimeConfiguration } from '../src/lib/server/runtime/environment.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { hashSessionToken } from '../src/lib/server/auth/session.ts';
import { Role } from '../src/lib/server/auth/roles.ts';

function requestEvent(token?: string): RequestEvent {
  return {
    request: new Request('http://cms.test/'), url: new URL('http://cms.test/'), locals: {},
    cookies: { get: () => token }, platform: undefined
  } as unknown as RequestEvent;
}

async function visit(handle: Handle, event: RequestEvent) {
  return handle({ event, resolve: async () => new Response('ok') });
}

test('sqlite.test.ts:25 — configured runtime opens a fresh database file in WAL mode', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-source-'));
  const runtime = createCmsRuntime(() => ({
    kind: 'sqlite', path: join(directory, 'data.db'), publicOrigin: 'http://cms.test'
  }));
  try {
    const event = requestEvent();
    await visit(runtime.handle, event);
    const db = event.locals.cms?.database.db;
    // Vitest toEqual compares row values irrespective of node:sqlite's null prototype.
    const result = db ? await sql<{ journal_mode: string }>`PRAGMA journal_mode`.execute(db) : { rows: [] };
    const rows = result.rows.map(row => ({ ...row }));
    assert.deepEqual(rows, [{ journal_mode: 'wal' }]);
    const synchronous = await sql<{ synchronous: number }>`PRAGMA synchronous`.execute(db!);
    assert.deepEqual(synchronous.rows.map(row => ({ ...row })), [{ synchronous: 1 }]);
  } finally { await runtime.close(); await rm(directory, { recursive: true, force: true }); }
});

test('configured storage persists content and resolves current trusted roles across runtime restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-restart-'));
  const config = { kind: 'sqlite' as const, path: join(directory, 'nested', 'data.db'), publicOrigin: 'http://cms.test', basePath: '/cms', rpName: 'My CMS' };
  let runtime = createCmsRuntime(() => config);
  const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
  try {
    const event = requestEvent();
    await visit(runtime.handle, event);
    const database = event.locals.cms!.database;
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'notes', label: 'Notes' });
    await registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
    const entry = await new DraftRepository(database).create({ type: 'notes', data: { title: 'Persistent draft' } }, 'owner');
    await database.db.insertInto('_cms_auth_users').values({ id: 'owner', role: Role.AUTHOR, disabled: 0 }).execute();
    await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'owner', expires_at: Date.now() + 60_000 }).execute();
    const authenticated = requestEvent(token);
    await visit(runtime.handle, authenticated);
    assert.equal(authenticated.locals.cms!.principal!.id, 'owner');
    assert.ok(authenticated.locals.cms!.principal!.permissions.includes('content:edit_own'));
    assert.ok(!authenticated.locals.cms!.principal!.permissions.includes('schema:manage'));
    assert.deepEqual(authenticated.locals.cmsRuntime, { publicOrigin: 'http://cms.test', basePath: '/cms', rpName: 'My CMS' });
    await database.db.updateTable('_cms_auth_users').set({ role: Role.ADMIN }).where('id', '=', 'owner').execute();
    const promoted = requestEvent(token);
    await visit(runtime.handle, promoted);
    assert.ok(promoted.locals.cms!.principal!.permissions.includes('schema:manage'));
    await runtime.close();
    runtime = createCmsRuntime(() => config);
    const reopened = requestEvent(token);
    await visit(runtime.handle, reopened);
    assert.equal(reopened.locals.cms!.principal!.id, 'owner');
    assert.equal((await new DraftRepository(reopened.locals.cms!.database).findById('notes', entry.id))!.data.title, 'Persistent draft');
    await reopened.locals.cms!.database.db.updateTable('_cms_auth_users').set({ disabled: 1 }).where('id', '=', 'owner').execute();
    const disabled = requestEvent(token);
    await visit(runtime.handle, disabled);
    assert.equal(disabled.locals.cms!.principal, null);
  } finally { await runtime.close(); await rm(directory, { recursive: true, force: true }); }
});

test('unconfigured runtime clears foreign locals and creates no trusted presentation or identity', async () => {
  const runtime = createCmsRuntime(() => undefined);
  try {
    const event = requestEvent('client-role-claim');
    event.locals.cms = { database: {} as never, principal: { id: 'claim', permissions: ['schema:manage'] }, mutationsEnabled: true };
    event.locals.cmsRuntime = { publicOrigin: 'https://claim.invalid', basePath: '', rpName: 'Claim' };
    await visit(runtime.handle, event);
    assert.equal(event.locals.cms, undefined);
    assert.equal(event.locals.cmsRuntime, undefined);
  } finally { await runtime.close(); }
});

test('concurrent first requests share a migrated adapter while sessions remain request-specific', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-concurrent-'));
  const runtime = createCmsRuntime(() => ({ kind: 'sqlite', path: join(directory, 'data.db'), publicOrigin: 'http://cms.test', mutationsEnabled: false }));
  try {
    const events = Array.from({ length: 10 }, () => requestEvent());
    await Promise.all(events.map(event => visit(runtime.handle, event)));
    assert.ok(events.every(event => event.locals.cms!.database === events[0].locals.cms!.database));
    assert.ok(events.every(event => event.locals.cms!.principal === null && event.locals.cms!.mutationsEnabled === false));
    const versions = await events[0].locals.cms!.database.db.selectFrom('_cms_migrations').select('version').execute();
    assert.equal(new Set(versions.map(row => row.version)).size, versions.length);
  } finally { await runtime.close(); await rm(directory, { recursive: true, force: true }); }
});

test('runtime rejects untrusted or malformed origins before opening configured storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-origin-'));
  try {
    for (const publicOrigin of ['http://cms.test/path', 'http://cms.test/', 'javascript:alert(1)', 'not-an-origin']) {
      const runtime = createCmsRuntime(() => ({ kind: 'sqlite', path: join(directory, 'data.db'), publicOrigin }));
      await assert.rejects(visit(runtime.handle, requestEvent()), /exact HTTP or HTTPS origin/);
      await runtime.close();
    }
    const { readdir } = await import('node:fs/promises');
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('runtime host configuration opts into one persistent adapter and trusted public origin', () => {
  assert.equal(runtimeConfiguration({}), undefined);
  assert.equal(runtimeConfiguration({ ORIGIN: 'http://cms.test' }), undefined);
  assert.throws(() => runtimeConfiguration({ SVELTERY_DATABASE_PATH: './data.db' }), /requires SVELTERY_PUBLIC_ORIGIN/);
  assert.deepEqual(runtimeConfiguration({ SVELTERY_DATABASE_PATH: './data.db', ORIGIN: 'http://cms.test' }, undefined, '/cms'), {
    kind: 'sqlite', path: './data.db', publicOrigin: 'http://cms.test', basePath: '/cms', rpName: 'Sveltery CMS', mutationsEnabled: true
  });
  assert.equal(runtimeConfiguration({ SVELTERY_DATABASE_PATH: './data.db', ORIGIN: 'http://cms.test', SVELTERY_MUTATIONS_ENABLED: 'false' })!.mutationsEnabled, false);
  assert.throws(() => runtimeConfiguration({ SVELTERY_DATABASE_PATH: './data.db', SVELTERY_D1_BINDING: 'SITE_DB', ORIGIN: 'http://cms.test' }), /one CMS database/);
  assert.throws(() => runtimeConfiguration({ SVELTERY_D1_BINDING: 'SITE_DB', ORIGIN: 'http://cms.test' }, { env: {} }), /SITE_DB.*d1_databases/);
});

test('configured runtime migrates the persistent database before resolving an anonymous session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-migrations-'));
  const runtime = createCmsRuntime(() => ({
    kind: 'sqlite', path: join(directory, 'data.db'), publicOrigin: 'http://cms.test'
  }));
  try {
    const event = requestEvent();
    await visit(runtime.handle, event);
    assert.ok(event.locals.cms, 'a configured request receives its trusted database');
    const versions = await event.locals.cms.database.db.selectFrom('_cms_migrations').selectAll().execute();
    assert.ok(versions.some(row => row.version === 2));
    assert.equal(event.locals.cms.principal, null);
    assert.equal(event.locals.cms.mutationsEnabled, true);
  } finally { await runtime.close(); await rm(directory, { recursive: true, force: true }); }
});
