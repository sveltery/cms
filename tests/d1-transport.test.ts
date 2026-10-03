// Original native harness tests. No copied EmDash assertions or parity credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { withPriorD1Notification } from './helpers/d1-notification-interleaving.ts';

test('control: installed Miniflare proxy exposes the delayed prior-notification race', { timeout: 15000 }, async () => {
  await withPriorD1Notification(async arm => {
    const runtime = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("control"); } }',
      compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false, d1Databases: { DB: 'notification-control' } });
    try {
      const binding = await runtime.getD1Database('DB');
      arm();
      await assert.rejects(async () => binding.prepare('SELECT 42 AS answer').all(),
        error => error instanceof Error && 'code' in error && error.code === 'ERR_ASSERTION'
          && error.message.includes('message?.id === id'));
    } finally { await runtime.dispose(); }
  });
});

test('D1 fixture matches each response when a prior synchronous notification arrives late', { timeout: 15000 }, async () => {
  await withPriorD1Notification(async arm => {
    const { schemaAdminStorage } = await import('./helpers/schema-admin-storage.ts');
    const storage = await schemaAdminStorage('D1');
    try {
      arm();
      const result = await sql<{ answer: number }>`SELECT 41 + 1 AS answer`.execute(storage.database.db);
      assert.deepEqual(result.rows, [{ answer: 42 }]);
    } finally { await storage.close(); }
  });
});

test('D1 fixture executes queries and atomic batches without synchronously blocking Node', { timeout: 15000 }, async () => {
  const originalWait = Atomics.wait;
  let waits = 0;
  Atomics.wait = (...args) => { waits++; return originalWait(...args); };
  try {
    const { schemaAdminStorage } = await import('./helpers/schema-admin-storage.ts');
    const storage = await schemaAdminStorage('D1');
    try {
      await storage.database.atomicBatch([sql`CREATE TABLE transport(value TEXT)`.compile(storage.database.db),
        sql`INSERT INTO transport VALUES (${'preserved'})`.compile(storage.database.db)]);
      assert.deepEqual((await sql`SELECT value FROM transport`.execute(storage.database.db)).rows, [{ value: 'preserved' }]);
      assert.equal(waits, 0, 'the harness must use asynchronous real Worker D1 requests');
    } finally { await storage.close(); }
  } finally { Atomics.wait = originalWait; }
});

test('D1 fixture preserves actual D1 parameters, result metadata and malformed-batch rollback', { timeout: 15000 }, async () => {
  const { schemaAdminStorage } = await import('./helpers/schema-admin-storage.ts');
  const storage = await schemaAdminStorage('D1');
  const database = storage.database;
  try {
    await sql`CREATE TABLE transport(id INTEGER PRIMARY KEY, value)`.execute(database.db);
    const accepted = [[null, null], ['literal\u0000quote\'text', 'literal\u0000quote\'text'], [17, 17], [false, 0],
      [new Uint8Array([0, 255]), [0, 255]], [new Uint8Array([0, 255]).buffer, [0, 255]], [[0, 255], [0, 255]]];
    for (const [parameter, expected] of accepted) {
      const results = await database.atomicBatch([sql`INSERT INTO transport(value) VALUES (${parameter})`.compile(database.db),
        sql`SELECT value FROM transport ORDER BY id DESC LIMIT 1`.compile(database.db)]);
      assert.equal(results[0].numAffectedRows, 1n);
      assert.equal(typeof results[0].insertId, 'bigint');
      assert.deepEqual(results[1].rows, [{ value: expected }]);
    }
    const before = (await sql`SELECT * FROM transport ORDER BY id`.execute(database.db)).rows;
    for (const unsupported of [undefined, 1n, {}, new Date(0), new Number(1)]) {
      await assert.rejects(() => database.atomicBatch([sql`INSERT INTO transport(value) VALUES (${'must roll back'})`.compile(database.db),
        sql`INSERT INTO transport(value) VALUES (${unsupported})`.compile(database.db)]), /D1_TYPE_ERROR/);
      assert.deepEqual((await sql`SELECT * FROM transport ORDER BY id`.execute(database.db)).rows, before);
    }
    await assert.rejects(() => database.atomicBatch([sql`CREATE TABLE transient(value TEXT)`.compile(database.db),
      sql`DELETE FROM transport`.compile(database.db), sql`SELECT * FROM missing_transport_table`.compile(database.db)]), /D1_ERROR:.*missing_transport_table/);
    assert.deepEqual((await sql`SELECT * FROM transport ORDER BY id`.execute(database.db)).rows, before);
    assert.deepEqual((await sql`SELECT name FROM sqlite_master WHERE name='transient'`.execute(database.db)).rows, []);
    assert.equal((await sql`UPDATE transport SET value=value WHERE id=-1`.execute(database.db)).numAffectedRows, undefined);
  } finally { await storage.close(); }
});

test('D1 fixture owns disposal and preserves isolated real D1 storage across restart', { timeout: 15000 }, async () => {
  const { schemaAdminStorage } = await import('./helpers/schema-admin-storage.ts');
  const directory = await mkdtemp(join(tmpdir(), 'cms-d1-transport-'));
  try {
    let storage = await schemaAdminStorage('D1', directory);
    await sql`CREATE TABLE retained(value TEXT)`.execute(storage.database.db);
    await Promise.all(Array.from({ length: 8 }, (_, index) => sql`INSERT INTO retained VALUES (${String(index)})`.execute(storage.database.db)));
    await storage.close();
    await assert.rejects(() => sql`SELECT * FROM retained`.execute(storage.database.db));
    storage = await schemaAdminStorage('D1', directory);
    const isolated = await schemaAdminStorage('D1');
    try {
      assert.deepEqual((await sql`SELECT value FROM retained ORDER BY value`.execute(storage.database.db)).rows,
        Array.from({ length: 8 }, (_, index) => ({ value: String(index) })));
      await assert.rejects(() => sql`SELECT * FROM retained`.execute(isolated.database.db), /no such table/);
    } finally { await storage.close(); await isolated.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
