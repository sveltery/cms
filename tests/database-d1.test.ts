import test from 'node:test';
import assert from 'node:assert/strict';
import { CompiledQuery, sql } from 'kysely';
import { Miniflare } from 'miniflare';
import { build } from 'vite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openD1, type D1Binding } from '../src/lib/server/database/d1.ts';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { migrateCms, CMS_MIGRATION_VERSION } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { createKyselySessionStore } from '../src/lib/server/auth/store.ts';
import { hashSessionToken, resolvePrincipal, revokeSession } from '../src/lib/server/auth/session.ts';
import { storageContract } from './helpers/storage-contract.ts';
import { sqliteErrorMessage } from '../src/lib/server/database/errors.ts';

async function localD1(path?: string, script = 'export default { fetch() { return new Response("fixture"); } }') {
  const runtime = new Miniflare({ modules: true, script, compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { DB: 'cms-test-d1' }, d1Persist: path ?? false, cf: false });
  const binding = await runtime.getD1Database('DB');
  return { runtime, binding, database: openD1(binding) };
}
async function versionOne(database: CmsDatabase) {
  const statements = JSON.parse(await readFile(new URL('./fixtures/cms-v1.json', import.meta.url), 'utf8')) as string[];
  await database.atomicBatch(statements.map(statement => CompiledQuery.raw(statement)));
}
// Local D1 may initialize its own metadata on the first write, outside the user batch.
// Compare every application object; _cf_METADATA is platform-owned, never CMS DDL.
const objects = async (database: CmsDatabase) => (await sql<{ name: string; sql: string }>`SELECT name, sql FROM sqlite_master WHERE name != '_cf_METADATA' ORDER BY name`.execute(database.db)).rows.map(row => ({ ...row }));
const versions = async (database: CmsDatabase) => (await database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row => row.version);

for (const target of ['Node', 'D1'] as const) {
  async function fixture() {
    if (target === 'Node') { const database = openSqlite(':memory:'); return { database, async close() { await database.close(); } }; }
    const local = await localD1();
    return { database: local.database, async close() { await local.database.close(); await local.runtime.dispose(); } };
  }
  test(`${target}: equivalent schema, scalar, CAS, soft-delete and persisted session contract`, { timeout: 30000 }, async () => {
    const local = await fixture();
    try { assert.deepEqual(await storageContract(local.database), [
      'fresh/idempotent migration', 'empty auth tables', 'persisted scalar schema', 'literal defaults/NUL/own keys',
      'unique metadata/required constraints', 'draft CAS/partial update', 'retained soft delete', 'schema CAS/DDL rollback',
      'persisted session/current role/disabled/expiry/revocation'
    ]); } finally { await local.close(); }
  });
  test(`${target}: failed batch rolls back DML and CREATE/ALTER/DROP DDL`, { timeout: 30000 }, async () => {
    const local = await fixture(); const database = local.database;
    try {
      await sql`CREATE TABLE existing (id INTEGER PRIMARY KEY, value TEXT UNIQUE)`.execute(database.db);
      await sql`INSERT INTO existing VALUES (1, 'original')`.execute(database.db);
      const before = await objects(database);
      await assert.rejects(() => database.atomicBatch([
        CompiledQuery.raw('CREATE TABLE transient (id INTEGER)'), CompiledQuery.raw('ALTER TABLE existing ADD COLUMN extra TEXT'),
        CompiledQuery.raw('UPDATE existing SET value = ?', ['changed']), CompiledQuery.raw('DROP TABLE existing'),
        CompiledQuery.raw('SELECT * FROM absent_batch_table')
      ]), /absent_batch_table/);
      assert.deepEqual(await objects(database), before);
      assert.deepEqual((await sql`SELECT * FROM existing`.execute(database.db)).rows.map(row => ({ ...row as object })), [{ id: 1, value: 'original' }]);
    } finally { await local.close(); }
  });
  test(`${target}: fresh/v1 auth failures roll back all DDL and migration markers`, { timeout: 30000 }, async () => {
    for (const upgrade of [false, true]) for (const failAt of ['auth', 'marker']) {
      const local = await fixture(); const database = local.database;
      try {
        if (upgrade) await versionOne(database);
        const before = await objects(database);
        const failing = { ...database, async atomicBatch(statements: readonly CompiledQuery[]) {
          const index = statements.findIndex(statement => failAt === 'auth' ? statement.sql.includes('CREATE TABLE _cms_auth_sessions') : /INSERT.*_cms_migrations.*2/s.test(statement.sql));
          assert.ok(index >= 0);
          return database.atomicBatch([...statements.slice(0, index + 1), CompiledQuery.raw('SELECT * FROM absent_auth_table'), ...statements.slice(index + 1)]);
        } };
        await assert.rejects(() => migrateCms(failing), /absent_auth_table/);
        assert.deepEqual(await objects(database), before);
        await migrateCms(database); assert.deepEqual(await versions(database), Array.from({length:CMS_MIGRATION_VERSION},(_,index)=>index+1));
      } finally { await local.close(); }
    }
  });
  test(`${target}: incomplete/future migration state fails without repair`, { timeout: 30000 }, async () => {
    for (const state of ['untracked', 'partial-v1', 'missing-index', 'malformed-auth', 'future', 'malformed-marker']) {
      const local = await fixture(); const database = local.database;
      try {
        if (state === 'untracked') await sql`CREATE TABLE _cms_auth_users (id TEXT)`.execute(database.db);
        else if (state === 'partial-v1') { await versionOne(database); await sql`CREATE TABLE _cms_auth_users (id TEXT)`.execute(database.db); }
        else if (state === 'malformed-marker') await sql`CREATE TABLE _cms_migrations (wrong INTEGER)`.execute(database.db);
        else {
          await migrateCms(database);
          if (state === 'missing-index') await sql`DROP INDEX idx_cms_auth_sessions_user`.execute(database.db);
          if (state === 'malformed-auth') await sql`ALTER TABLE _cms_auth_users RENAME COLUMN role TO wrong_role`.execute(database.db);
          if (state === 'future') { await sql`DROP TABLE _cms_migrations`.execute(database.db); await sql`CREATE TABLE _cms_migrations (version INTEGER)`.execute(database.db); await sql`INSERT INTO _cms_migrations VALUES (1), (2), (3)`.execute(database.db); }
        }
        const before = await objects(database);
        await assert.rejects(() => migrateCms(database), { code: 'MIGRATION_REQUIRED' });
        assert.deepEqual(await objects(database), before);
      } finally { await local.close(); }
    }
  });
}

test('D1: deterministic stale fresh/v1 callers recover the actual binding error envelope', { timeout: 30000 }, async () => {
  for (const upgrade of [false, true]) {
    const { runtime, binding, database: a } = await localD1(); const b = openD1(binding);
    const errors: Error[] = []; let arrivals = 0; let ready!: () => void;
    const barrier = new Promise<void>(resolve => { ready = resolve; });
    function caller(database: CmsDatabase): CmsDatabase {
      return { ...database, async atomicBatch(statements) {
        if (++arrivals === 2) ready(); await barrier;
        try { return await database.atomicBatch(statements); }
        catch (cause) { assert.ok(cause instanceof Error); errors.push(cause); throw cause; }
      } };
    }
    try {
      if (upgrade) await versionOne(a);
      assert.deepEqual((await Promise.allSettled([migrateCms(caller(a)), migrateCms(caller(b))])).map(value => value.status), ['fulfilled', 'fulfilled']);
      assert.equal(arrivals, 2); assert.equal(errors.length, 1, 'both preflights reach a real failing batch');
      assert.match(errors[0].message, /^D1_ERROR:/);
      assert.match(errors[0].message, upgrade ? /CHECK constraint failed: pass = 1/ : /table _cms_migrations already exists/);
      assert.deepEqual(await versions(a), Array.from({length:CMS_MIGRATION_VERSION},(_,index)=>index+1));
      assert.deepEqual(await a.db.selectFrom('_cms_guards').selectAll().execute(), []);
    } finally { await b.close(); await a.close(); await runtime.dispose(); }
  }
});
test('D1: concurrent same-slug creators map the real UNIQUE envelope to COLLECTION_EXISTS', { timeout: 30000 }, async () => {
  const { runtime, binding, database } = await localD1(); const other = openD1(binding);
  let arrivals = 0; let ready!: () => void; const barrier = new Promise<void>(resolve => { ready = resolve; });
  const caller = (db: CmsDatabase): CmsDatabase => ({ ...db, async atomicBatch(statements) { if (++arrivals === 2) ready(); await barrier; return db.atomicBatch(statements); } });
  try {
    await migrateCms(database);
    const outcomes = await Promise.allSettled([new SchemaRegistry(caller(database)).createCollection({ slug: 'same', label: 'Same' }), new SchemaRegistry(caller(other)).createCollection({ slug: 'same', label: 'Same' })]);
    assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
    assert.ok(outcomes.some(value => value.status === 'rejected' && value.reason.code === 'COLLECTION_EXISTS'));
    assert.equal((await database.db.selectFrom('_cms_collections').selectAll().execute()).length, 1);
    assert.deepEqual(await database.db.selectFrom('_cms_guards').selectAll().execute(), []);
  } finally { await other.close(); await database.close(); await runtime.dispose(); }
});
test('D1: startup accepts a complete upgrade between actual preflight reads', { timeout: 30000 }, async () => {
  const { runtime, binding, database: a } = await localD1(); const b = openD1(binding);
  try {
    await versionOne(a); const queries = new Set<unknown>(); let committed = false;
    const observing = { ...b, db: b.db.withPlugin({
      transformQuery(args) { if (JSON.stringify(args.node).includes('sqlite_master')) queries.add(args.queryId); return args.node; },
      async transformResult(args) { if (!committed && queries.has(args.queryId)) { committed = true; await migrateCms(a); } return args.result; }
    }) };
    await migrateCms(observing); assert.equal(committed, true); assert.deepEqual(await versions(b), Array.from({length:CMS_MIGRATION_VERSION},(_,index)=>index+1));
  } finally { await b.close(); await a.close(); await runtime.dispose(); }
});
test('D1: one actual batch forwards parameters/order, RETURNING rows, zero/positive changes and insert IDs', { timeout: 30000 }, async () => {
  const { runtime, binding, database } = await localD1(); const calls: string[][] = [];
  const tracked: D1Binding = { prepare: query => binding.prepare(query), async batch(statements) { calls.push(statements.map(() => 'statement')); return binding.batch(statements as Parameters<typeof binding.batch>[0]); } };
  const cms = openD1(tracked);
  try {
    await sql`CREATE TABLE media (id INTEGER PRIMARY KEY, status TEXT, storage_key TEXT)`.execute(cms.db);
    const results = await cms.atomicBatch([
      CompiledQuery.raw('INSERT INTO media (status, storage_key) VALUES (?, ?)', ['pending', 'expired.png']),
      CompiledQuery.raw('UPDATE media SET status = ? WHERE id = ?', ['pending', 1]),
      CompiledQuery.raw('UPDATE media SET status = ? WHERE id = ?', ['missing', 99]),
      CompiledQuery.raw('DELETE FROM media WHERE status = ? RETURNING storage_key', ['pending'])
    ]);
    assert.equal(calls.length, 1); assert.equal(calls[0].length, 4);
    assert.equal(results[0].insertId, 1n); assert.equal(results[0].numAffectedRows, 1n);
    assert.equal(results[1].numAffectedRows, 1n); assert.equal(results[2].numAffectedRows, undefined, 'pinned upstream maps zero to undefined');
    assert.deepEqual(results[3].rows, [{ storage_key: 'expired.png' }]); assert.equal(results[3].numAffectedRows, 1n);
    const noChange = await sql`UPDATE media SET status = 'none' WHERE id = 99`.execute(cms.db);
    assert.equal(noChange.numAffectedRows, undefined);
    assert.equal(Object.hasOwn(noChange, 'numUpdatedOrDeletedRows'), false, 'bounded QueryResult omits the deprecated upstream ordinary-query alias');
  } finally { await cms.close(); await database.close(); await runtime.dispose(); }
});
test('D1: unrelated envelopes do not turn into successful migration race recovery', { timeout: 30000 }, async () => {
  const { runtime, database } = await localD1();
  try {
    const failing = { ...database, async atomicBatch(statements: readonly CompiledQuery[]) {
      await database.atomicBatch(statements);
      await sql`SELECT * FROM unrelated_storage_failure`.execute(database.db);
      return [];
    } };
    await assert.rejects(() => migrateCms(failing), /unrelated_storage_failure/);
    assert.deepEqual(await versions(database), Array.from({length:CMS_MIGRATION_VERSION},(_,index)=>index+1), 'completed schema alone cannot swallow unexpected failures');
  } finally { await database.close(); await runtime.dispose(); }
});
test('local: envelope classifier keeps Node messages and ignores lookalike/unknown D1 formats', () => {
  const node = 'table _cms_migrations already exists';
  assert.equal(sqliteErrorMessage(new Error(node)), node);
  assert.equal(sqliteErrorMessage(new Error(`D1_ERROR: ${node} at offset 13: SQLITE_ERROR`)), node);
  assert.equal(sqliteErrorMessage(new Error('D1_ERROR: CHECK constraint failed: pass = 1: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_CHECK)')), 'CHECK constraint failed: pass = 1');
  for (const message of [`other D1_ERROR: ${node}: SQLITE_ERROR`, `D1_ERROR: ${node}: UNRECOGNIZED`, `D1_ERROR: ${node}: SQLITE_ERROR trailing`]) {
    assert.equal(sqliteErrorMessage(new Error(message)), message);
  }
  assert.equal(sqliteErrorMessage(node), undefined);
});
test('D1: callback transactions, streaming and general introspection reject explicitly', { timeout: 30000 }, async () => {
  const { runtime, database } = await localD1(); let called = false;
  try {
    await assert.rejects(() => database.db.transaction().execute(async () => { called = true; }), /callback transactions are unsupported/);
    assert.equal(called, false);
    assert.throws(() => database.db.introspection, /outside the bounded CMS adapter/);
    await assert.rejects(async () => { for await (const _row of database.db.selectFrom('_cms_migrations').selectAll().stream()) { called = true; } }, /streaming is unsupported/);
  } finally { await database.close(); await runtime.dispose(); }
});

test('D1: raw parameter variants retain binding support/rejections without Node normalization', { timeout: 30000 }, async () => {
  const { runtime, database } = await localD1();
  try {
    await sql`CREATE TABLE parameters (value)`.execute(database.db);
    for (const value of [undefined, 7n, {}, new Date(0), new Number(1)]) {
      await assert.rejects(() => database.atomicBatch([
        CompiledQuery.raw('INSERT INTO parameters VALUES (?)', ['would commit']),
        CompiledQuery.raw('INSERT INTO parameters VALUES (?)', [value])
      ]), /D1_TYPE_ERROR/);
      assert.deepEqual((await sql`SELECT * FROM parameters`.execute(database.db)).rows, []);
    }
    for (const [value, expected] of [[null, null], [true, 1], [false, 0], [7, 7], ['text', 'text'],
      [new Uint8Array([1, 2]), [1, 2]], [new Uint8Array([1, 2]).buffer, [1, 2]], [[1, 2], [1, 2]]] as const) {
      const result = await database.db.executeQuery<{ value: unknown }>(CompiledQuery.raw('SELECT ? AS value', [value]));
      assert.deepEqual(result.rows, [{ value: expected }]);
    }
  } finally { await database.close(); await runtime.dispose(); }
});

test('D1 and Node: v1 content and hashed sessions persist across close/reopen and revocation', { timeout: 30000 }, async () => {
  for (const target of ['Node', 'D1']) {
    const dir = await mkdtemp(join(tmpdir(), 'cms-d1-reopen-'));
    let runtime: Miniflare | undefined;
    async function open() {
      if (target === 'Node') return openSqlite(join(dir, 'cms.sqlite'));
      const local = await localD1(dir); runtime = local.runtime; return local.database;
    }
    let database = await open();
    const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; const hash = await hashSessionToken(token); assert.ok(hash);
    try {
      await versionOne(database);
      const registry = new SchemaRegistry(database); const entries = new DraftRepository(database);
      await registry.createCollection({ slug: 'preserved', label: 'Preserved' });
      await registry.createField('preserved', { slug: 'title', label: 'Title', type: 'string' });
      const entry = await entries.create({ type: 'preserved', data: { title: 'Preserve' } }, 'author');
      const definition = await registry.getCollectionWithFields('preserved');
      await migrateCms(database);
      assert.deepEqual(await registry.getCollectionWithFields('preserved'), definition);
      await database.db.insertInto('_cms_auth_users').values({ id: 'author', role: 20, disabled: 0 }).execute();
      await database.db.insertInto('_cms_auth_sessions').values({ hash, user_id: 'author', expires_at: 1001 }).execute();
      await database.close(); await runtime?.dispose(); database = await open(); await migrateCms(database);
      assert.deepEqual(await new DraftRepository(database).findById('preserved', entry.id), entry);
      assert.deepEqual(await new SchemaRegistry(database).getCollectionWithFields('preserved'), definition);
      assert.deepEqual(await resolvePrincipal(token, createKyselySessionStore(database.db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()), { now: () => 1000 }), { id: 'author', role: 20 });
      assert.equal((await database.db.selectFrom('_cms_auth_sessions').selectAll().execute())[0].hash, hash);
      await revokeSession(token, createKyselySessionStore(database.db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()));
      await database.close(); await runtime?.dispose(); database = await open();
      assert.equal(await resolvePrincipal(token, createKyselySessionStore(database.db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()), { now: () => 1000 }), null);
      assert.deepEqual(await database.db.selectFrom('_cms_auth_sessions').selectAll().execute(), []);
    } finally { await database.close(); await runtime?.dispose(); await rm(dir, { recursive: true, force: true }); }
  }
});
test('local workerd: real D1-backed CMS/session core runs without nodejs_compat', { timeout: 30000 }, async () => {
  const built = await build({ configFile: false, logLevel: 'error', build: { target: 'es2022', minify: false, write: false,
    lib: { entry: new URL('./helpers/d1-worker.ts', import.meta.url).pathname, formats: ['es'], fileName: 'd1-worker' } } });
  assert.ok(!('on' in built));
  const outputs = Array.isArray(built) ? built : [built]; const chunks = outputs.flatMap(output => output.output).filter(output => output.type === 'chunk');
  assert.equal(chunks.length, 1); assert.doesNotMatch(chunks[0].code, /node:sqlite/);
  const { runtime, database } = await localD1(undefined, chunks[0].code);
  try {
    const response = await runtime.dispatchFetch('https://cms.example/'); assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as { passed: string[] }).passed, [
      'fresh/idempotent migration', 'empty auth tables', 'persisted scalar schema', 'literal defaults/NUL/own keys',
      'unique metadata/required constraints', 'draft CAS/partial update', 'retained soft delete', 'schema CAS/DDL rollback',
      'persisted session/current role/disabled/expiry/revocation'
    ]);
    assert.deepEqual(await versions(database), Array.from({length:CMS_MIGRATION_VERSION},(_,index)=>index+1), 'worker migrated the actual binding');
  } finally { await database.close(); await runtime.dispose(); }
});
