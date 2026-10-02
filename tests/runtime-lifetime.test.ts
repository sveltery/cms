// Supplemental native runtime lifetime regressions; no EmDash source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime, type RuntimeConfiguration } from '../src/lib/server/runtime/composition.ts';
import type { D1Binding, D1Statement } from '../src/lib/server/database/d1.ts';

// Adopted from the independent reviewer's deterministic PR #36 regression.
test('runtime close prevents an in-flight configuration from opening a new database afterward', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-review-close-'));
  const configured = Promise.withResolvers<RuntimeConfiguration>();
  const runtime = createCmsRuntime(() => configured.promise);
  const event = { locals: {}, cookies: { get() {} } } as unknown as RequestEvent;
  const request = Promise.resolve(runtime.handle({ event, resolve: async () => new Response('ok') }));
  try {
    await runtime.close();
    configured.resolve({ kind: 'sqlite', path: join(directory, 'late.db'), publicOrigin: 'http://cms.test' });
    await assert.rejects(request, /closed/);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    configured.resolve({ kind: 'sqlite', path: join(directory, 'late.db'), publicOrigin: 'http://cms.test' });
    await Promise.allSettled([request, runtime.close()]);
    await rm(directory, { recursive: true, force: true });
  }
});

test('all close callers await an already-started migration and its request cannot use the closing adapter', { timeout: 30_000 }, async () => {
  const worker = new Miniflare({ modules: true, script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, d1Databases: { CMS_DB: 'cms-runtime-lifetime' }, cf: false });
  const original = await worker.getD1Database('CMS_DB');
  const migrationStarted = Promise.withResolvers<void>();
  const continueMigration = Promise.withResolvers<void>();
  const statements = new WeakMap<D1Statement, D1Statement>();
  let firstRead = true;
  function wrap(statement: D1Statement): D1Statement {
    const wrapped: D1Statement = {
      bind(...parameters) { return wrap(statement.bind(...parameters)); },
      async all() {
        if (firstRead) {
          firstRead = false;
          migrationStarted.resolve();
          await continueMigration.promise;
        }
        return statement.all();
      }
    };
    statements.set(wrapped, statement);
    return wrapped;
  }
  const binding: D1Binding = {
    prepare: query => wrap(original.prepare(query)),
    batch: values => original.batch(values.map(value => statements.get(value)!))
  };
  const runtime = createCmsRuntime(() => ({ kind: 'd1', binding, publicOrigin: 'https://cms.example' }));
  const event = { locals: {}, cookies: { get() {} } } as unknown as RequestEvent;
  let resolved = false;
  const request = Promise.resolve(runtime.handle({ event, resolve: async () => { resolved = true; return new Response('ok'); } }));
  // Keep early rejection handled while the deterministic migration barrier is held.
  void request.catch(() => {});
  let firstClose: Promise<void> | undefined;
  let secondClose: Promise<void> | undefined;
  try {
    await migrationStarted.promise;
    firstClose = runtime.close();
    let secondClosed = false;
    secondClose = runtime.close().then(() => { secondClosed = true; });
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(secondClosed, false, 'every close caller waits for initialization cleanup');
    continueMigration.resolve();
    await assert.rejects(request, /closed/);
    await Promise.all([firstClose, secondClose]);
    assert.equal(resolved, false);
    assert.equal(event.locals.cms, undefined);
    assert.equal(event.locals.cmsRuntime, undefined);
    await assert.rejects(async () => runtime.handle({ event, resolve: async () => new Response('late') }), /closed/);
  } finally {
    continueMigration.resolve();
    await Promise.allSettled([request, firstClose, secondClose]);
    await runtime.close();
    await worker.dispose();
  }
});
