// Supplemental anonymous requests over real local workerd/D1 storage.
// Explicit owned redirect DDL provides zero application/deployment credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import type { RequestEvent } from '@sveltejs/kit';
import { sql, type Kysely } from 'kysely';
import { createCmsRuntime } from '../src/lib/server/runtime/composition.ts';
import { installRedirectTables } from '../src/lib/server/redirects/migrations/index.ts';
import { RedirectRepository } from '../src/lib/server/redirects/repository.ts';
import type { Database } from '../src/lib/server/redirects/database-types.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { createDatabaseRedirectSource, publishRedirectArtifacts } from '../src/lib/server/redirects/artifacts.ts';
import { after } from '../src/lib/server/redirects/after.ts';

test('anonymous scoped D1 redirects retain deferred hits and deduplicated misses', { timeout: 30_000 }, async () => {
  const worker = new Miniflare({ modules: true,
    script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { CMS_DB: 'cms-redirect-native-d1' }, cf: false });
  const binding = await worker.getD1Database('CMS_DB');
  const deferred: Promise<void>[] = [];
  const runtime = createCmsRuntime(() => ({ kind: 'd1', binding, publicOrigin: 'https://cms.test',
    d1: { binding: 'CMS_DB', session: 'auto' }, keepAlive: task => deferred.push(task) }));
  function event(path: string, method = 'GET') {
    const url = new URL(path, 'https://cms.test');
    return { url, request: new Request(url, { method }), locals: {},
      cookies: { get: () => undefined, set() {}, serialize: () => '' }
    } as unknown as RequestEvent;
  }
  try {
    const initial = event('/');
    await runtime.handle({ event: initial, resolve: async () => new Response('page') });
    const base = initial.locals.cms!.database;
    // The ordinary configured runtime already installed the real latest schema.
    const db = base.db.withTables<{ [Name in keyof Database]: Database[Name] }>().$pickTables<keyof Database>();
    const repo = new RedirectRepository(db);
    const rule = await repo.create({ source: '/old', destination: '/new', type: 308 });
    const redirectedEvent = event('/old');
    const redirected = await runtime.handle({ event: redirectedEvent, resolve: async () => new Response('page') });
    assert.equal(redirected.status, 308);
    assert.equal(redirected.headers.get('Location'), '/new');
    assert.notEqual(redirectedEvent.locals.cms!.database, base);
    assert.equal(redirectedEvent.locals.cms!.principal, null);
    await Promise.all(deferred);
    assert.equal((await repo.findById(rule.id))!.hits, 1);
    for (const method of ['GET', 'POST']) {
      const response = await runtime.handle({ event: event('/missing', method),
        resolve: async () => new Response('missing', { status: 404 }) });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      await Promise.all(deferred);
    }
    const rows = await db.selectFrom('_cms_404_log').select(['path', 'hits']).execute();
    assert.deepEqual(rows, [{ path: '/missing', hits: 2 }]);
    assert.ok(deferred.length >= 3);
  } finally { await Promise.allSettled(deferred); await runtime.close(); await worker.dispose(); }
});

test('real D1 publishes large sharded rules and preserves pattern order', { timeout: 30_000 }, async () => {
  const worker = new Miniflare({ modules: true,
    script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { CMS_DB: 'cms-redirect-large-artifacts-d1' }, cf: false });
  const storage = openD1(await worker.getD1Database('CMS_DB'));
  const tasks: Promise<void>[] = [];
  try {
    await installRedirectTables(storage.db as unknown as Kysely<unknown>);
    const db = storage.db.withTables<{ [Name in keyof Database]: Database[Name] }>().$pickTables<keyof Database>();
    const padding = 'x'.repeat(200);
    const rows = [];
    for (let i = 0; i < 800; i++) {
      const n = String(i).padStart(4, '0');
      rows.push({ id: `e${n}`, source: `/exact/${n}`, destination: `/to/${padding}/${n}`,
        type: 301, is_pattern: 0, enabled: 1, hits: 0, auto: 0,
        created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' });
      rows.push({ id: `p${n}`, source: `/pattern/${n}/[slug]`, destination: `/to/${padding}/[slug]`,
        type: 301, is_pattern: 1, enabled: 1, hits: 0, auto: 0,
        created_at: `2026-01-01T00:00:${String(59 - (i % 60)).padStart(2, '0')}.000Z`,
        updated_at: '2026-01-01T00:00:00.000Z' });
    }
    // Original native setup respects D1's100 parameters per statement. The
    // immutable Source100-row fixture remains unchanged and explicitly fails.
    for (let i = 0; i < rows.length; i += 10) {
      await sql`INSERT INTO _cms_redirects
        (id,source,destination,type,is_pattern,enabled,hits,auto,created_at,updated_at)
        VALUES ${sql.join(rows.slice(i, i + 10).map(row => sql`(
          ${row.id},${row.source},${row.destination},${row.type},${row.is_pattern},
          ${row.enabled},${row.hits},${row.auto},${row.created_at},${row.updated_at})`))}`.execute(db);
    }
    await publishRedirectArtifacts(db);
    const source = createDatabaseRedirectSource(db, fn => after(fn, task => tasks.push(task)));
    const loaded = await source.load();
    const direct = await new RedirectRepository(db).findAllEnabled();
    assert.notEqual(loaded.version, null);
    assert.equal(loaded.exact.length, 800);
    assert.deepEqual(loaded.patterns.map(rule => rule.id), direct.filter(rule => rule.isPattern).map(rule => rule.id));
    const before = await db.selectFrom('_cms_redirect_artifacts').select('digest').where('kind', '=', 'exact').execute();
    assert.ok(before.length > 2);
    await db.updateTable('_cms_redirects').set({ destination: `/to/${padding}/changed` }).where('id', '=', 'e0500').execute();
    await publishRedirectArtifacts(db);
    const changed = await db.selectFrom('_cms_redirect_artifacts').select('digest').where('kind', '=', 'exact').execute();
    const previous = new Set(before.map(row => row.digest));
    assert.equal(changed.length, before.length);
    assert.equal(changed.filter(row => !previous.has(row.digest)).length, 1);
  } finally { await Promise.allSettled(tasks); await storage.close(); await worker.dispose(); }
});

test('real D1 repairs and serves a published redirect generation', { timeout: 30_000 }, async () => {
  const worker = new Miniflare({ modules: true,
    script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { CMS_DB: 'cms-redirect-artifacts-d1' }, cf: false });
  const storage = openD1(await worker.getD1Database('CMS_DB'));
  const tasks: Promise<void>[] = [];
  try {
    await installRedirectTables(storage.db as unknown as Kysely<unknown>);
    const db = storage.db.withTables<{ [Name in keyof Database]: Database[Name] }>().$pickTables<keyof Database>();
    await new RedirectRepository(db).create({ source: '/old', destination: '/new', type: 308 });
    const source = createDatabaseRedirectSource(db, fn => after(fn, task => tasks.push(task)));
    await source.load();
    await Promise.all(tasks);
    const repaired = await source.load();
    assert.notEqual(repaired.version, null);
    assert.deepEqual(repaired.exact.map(rule => ({ source: rule.source, destination: rule.destination })),
      [{ source: '/old', destination: '/new' }]);
  } finally { await Promise.allSettled(tasks); await storage.close(); await worker.dispose(); }
});
