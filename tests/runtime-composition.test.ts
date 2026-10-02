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
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../src/lib/server/runtime/composition.ts';

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
    const { rows } = db ? await sql<{ journal_mode: string }>`PRAGMA journal_mode`.execute(db) : { rows: [] };
    assert.deepEqual(rows, [{ journal_mode: 'wal' }]);
    const synchronous = await sql<{ synchronous: number }>`PRAGMA synchronous`.execute(db!);
    assert.deepEqual(synchronous.rows, [{ synchronous: 1 }]);
  } finally { await runtime.close(); await rm(directory, { recursive: true, force: true }); }
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
