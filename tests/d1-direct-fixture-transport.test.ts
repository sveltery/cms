// Original native fixture tests. No copied EmDash assertions or Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localD1 } from './helpers/local-d1-fixture.ts';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';

async function closeLocal({ runtime, database }: Awaited<ReturnType<typeof localD1>>) {
  try { await database.close(); } finally { await runtime.dispose(); }
}

const fixtures = {
  'local database': async (directory?: string) => {
    const local = await localD1(directory);
    return { database: local.database, close: () => closeLocal(local) };
  },
  'collection update': (directory?: string) => collectionUpdateStorage('D1', directory)
};
const originalIdentifiers: Record<string, string> = { 'local database': 'cms-test-d1', 'collection update': 'cms-collection-update' };

for (const [name, open] of Object.entries(fixtures)) {
  test(`${name}: actual D1 values and atomic rollback use zero synchronous waits`, { timeout: 15000 }, async () => {
    const originalWait = Atomics.wait;
    let waits = 0;
    Atomics.wait = (...args) => { waits++; return Reflect.apply(originalWait, Atomics, args); };
    try {
      const fixture = await open();
      const { database } = fixture;
      try {
        await sql`CREATE TABLE direct_transport(id INTEGER PRIMARY KEY, value)`.execute(database.db);
        const accepted = [[null, null], ['literal\u0000quote\'text', 'literal\u0000quote\'text'], [17, 17], [false, 0],
          [new Uint8Array([0, 255]), [0, 255]], [new Uint8Array([0, 255]).buffer, [0, 255]], [[0, 255], [0, 255]]];
        for (const [value, expected] of accepted) {
          const results = await database.atomicBatch([sql`INSERT INTO direct_transport(value) VALUES (${value})`.compile(database.db),
            sql`SELECT value FROM direct_transport ORDER BY id DESC LIMIT 1`.compile(database.db)]);
          assert.equal(results[0].numAffectedRows, 1n);
          assert.equal(typeof results[0].insertId, 'bigint');
          assert.deepEqual(results[1].rows, [{ value: expected }]);
        }
        const before = (await sql`SELECT * FROM direct_transport ORDER BY id`.execute(database.db)).rows;
        for (const unsupported of [undefined, 1n, {}, new Date(0), new Number(1)]) {
          await assert.rejects(() => database.atomicBatch([sql`INSERT INTO direct_transport(value) VALUES (${'must roll back'})`.compile(database.db),
            sql`INSERT INTO direct_transport(value) VALUES (${unsupported})`.compile(database.db)]), /D1_TYPE_ERROR/);
          assert.deepEqual((await sql`SELECT * FROM direct_transport ORDER BY id`.execute(database.db)).rows, before);
        }
        await assert.rejects(() => database.atomicBatch([sql`CREATE TABLE direct_transient(value TEXT)`.compile(database.db),
          sql`DELETE FROM direct_transport`.compile(database.db), sql`SELECT * FROM absent_direct_transport`.compile(database.db)]), /D1_ERROR:.*absent_direct_transport/);
        assert.deepEqual((await sql`SELECT * FROM direct_transport ORDER BY id`.execute(database.db)).rows, before);
        assert.deepEqual((await sql`SELECT name FROM sqlite_master WHERE name='direct_transient'`.execute(database.db)).rows, []);
        assert.equal((await sql`UPDATE direct_transport SET value=value WHERE id=-1`.execute(database.db)).numAffectedRows, undefined);
        assert.equal(waits, 0, 'fixture operations must use asynchronous real Worker D1 requests');
      } finally { await fixture.close(); }
    } finally { Atomics.wait = originalWait; }
  });
}

test('local database: custom Worker dispatch retains request data and the same actual DB', { timeout: 15000 }, async () => {
  const script = `export default { async fetch(request, env) {
    const input = await request.text();
    await env.DB.prepare('INSERT INTO custom_dispatch(value) VALUES (?)').bind(input).run();
    return Response.json({ url: request.url, method: request.method, marker: request.headers.get('X-Fixture-Marker'), input });
  } };`;
  const local = await localD1(undefined, script);
  const { runtime, database } = local;
  try {
    await sql`CREATE TABLE custom_dispatch(value TEXT)`.execute(database.db);
    const response = await runtime.dispatchFetch('https://cms.example/custom?retained=1', {
      method: 'POST', headers: { 'X-Fixture-Marker': 'ordinary fixture' }, body: 'literal\u0000body'
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: 'https://cms.example/custom?retained=1', method: 'POST',
      marker: 'ordinary fixture', input: 'literal\u0000body' });
    assert.deepEqual((await sql`SELECT value FROM custom_dispatch`.execute(database.db)).rows, [{ value: 'literal\u0000body' }]);
  } finally { await closeLocal(local); }
});

test('direct fixtures: original persistent DB identifiers remain separate across restart', { timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-direct-d1-'));
  try {
    for (const [name, open] of Object.entries(fixtures)) {
      // Initialize through the unchanged raw Miniflare API under the exact old
      // identifier, so a silently renamed fixture database cannot pass reopen.
      const control = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("control"); } }',
        compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
        d1Databases: { DB: originalIdentifiers[name] }, d1Persist: directory });
      try {
        const binding = await control.getD1Database('DB');
        await binding.prepare('CREATE TABLE retained_direct(value TEXT)').run();
        await binding.prepare('INSERT INTO retained_direct VALUES (?)').bind(name).run();
      } finally { await control.dispose(); }
      const fixture = await open(directory);
      try {
        assert.deepEqual((await sql`SELECT value FROM retained_direct`.execute(fixture.database.db)).rows, [{ value: name }]);
        await sql`INSERT INTO retained_direct VALUES (${'reopened'})`.execute(fixture.database.db);
      } finally { await fixture.close(); }
    }
    for (const [name, open] of Object.entries(fixtures)) {
      const fixture = await open(directory);
      try {
        assert.deepEqual((await sql`SELECT value FROM retained_direct ORDER BY rowid`.execute(fixture.database.db)).rows, [{ value: name }, { value: 'reopened' }]);
      } finally { await fixture.close(); }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
