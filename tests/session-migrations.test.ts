import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { readFileSync } from 'node:fs';

// Captured exact version-one schema from base main 8bd3e62; no auth tables.
async function v1(database: ReturnType<typeof openSqlite>) {
  const statements = JSON.parse(readFileSync(new URL('./fixtures/cms-v1.json', import.meta.url), 'utf8')) as string[];
  for (const statement of statements) await sql.raw(statement).execute(database.db);
}
const names = async (database: ReturnType<typeof openSqlite>) => (await sql<{ name: string; sql: string }>`SELECT name, sql FROM sqlite_master ORDER BY name`.execute(database.db)).rows;

test('clean migration registers empty auth tables and version two, and is idempotent', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database); await migrateCms(database);
    assert.deepEqual((await database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row => ({ ...row })), [{ version: 1 }, { version: 2 }]);
    assert.deepEqual(await database.db.selectFrom('_cms_auth_users').selectAll().execute(), []);
    assert.deepEqual(await database.db.selectFrom('_cms_auth_sessions').selectAll().execute(), []);
  } finally { await database.close(); }
});

test('version-one upgrade preserves definitions/drafts across migration and restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cms-session-migration-')); const path = join(dir, 'cms.sqlite');
  let database = openSqlite(path);
  try {
    await v1(database);
    const registry = new SchemaRegistry(database); const entries = new DraftRepository(database);
    await registry.createCollection({ slug: 'notes', label: 'Notes' });
    await registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
    const entry = await entries.create({ type: 'notes', data: { title: 'Preserve' } }, 'author');
    const definition = await registry.getCollectionWithFields('notes');
    await migrateCms(database);
    assert.deepEqual(await entries.findById('notes', entry.id), entry);
    assert.deepEqual(await registry.getCollectionWithFields('notes'), definition);
    assert.deepEqual(await database.db.selectFrom('_cms_auth_users').selectAll().execute(), []);
    await database.close(); database = openSqlite(path); await migrateCms(database);
    assert.deepEqual(await new DraftRepository(database).findById('notes', entry.id), entry);
  } finally { await database.close(); await rm(dir, { recursive: true, force: true }); }
});

test('incomplete, untracked and future migration states reject without repair', async () => {
  for (const state of ['untracked-auth', 'v1-auth', 'missing-users', 'missing-sessions', 'missing-index', 'missing-v1', 'future', 'malformed-users']) {
    const database = openSqlite(':memory:');
    try {
      if (state === 'untracked-auth') await sql`CREATE TABLE _cms_auth_users (id TEXT)`.execute(database.db);
      else if (state === 'v1-auth') { await v1(database); await sql`CREATE TABLE _cms_auth_users (id TEXT)`.execute(database.db); }
      else {
        await migrateCms(database);
        if (state === 'missing-users') await sql`DROP TABLE _cms_auth_users`.execute(database.db);
        if (state === 'missing-sessions') await sql`DROP TABLE _cms_auth_sessions`.execute(database.db);
        if (state === 'missing-index') await sql`DROP INDEX idx_cms_auth_sessions_user`.execute(database.db);
        if (state === 'missing-v1') await sql`DELETE FROM _cms_migrations WHERE version = 1`.execute(database.db);
        if (state === 'future') { await sql`PRAGMA ignore_check_constraints = ON`.execute(database.db); await sql`INSERT INTO _cms_migrations(version) VALUES (3)`.execute(database.db); }
        if (state === 'malformed-users') { await sql`ALTER TABLE _cms_auth_users RENAME COLUMN role TO wrong_role`.execute(database.db); }
      }
      const before = await names(database);
      await assert.rejects(() => migrateCms(database), { code: 'MIGRATION_REQUIRED' });
      assert.deepEqual(await names(database), before);
    } finally { await database.close(); }
  }
});

test('failed auth DDL or marker commits roll back the entire clean/upgrade batch', async () => {
  for (const upgrade of [false, true]) for (const failAt of ['auth', 'marker']) {
    const database = openSqlite(':memory:');
    try {
      if (upgrade) await v1(database);
      const before = await names(database);
      const failing = { ...database, async atomicBatch(statements: Parameters<typeof database.atomicBatch>[0]) {
        const index = statements.findIndex(s => failAt === 'auth' ? s.sql.includes('CREATE TABLE _cms_auth_sessions') : /INSERT.*_cms_migrations.*2/s.test(s.sql));
        assert.ok(index >= 0, 'test reaches auth migration statement');
        return database.atomicBatch([...statements.slice(0, index + 1), sql`SELECT * FROM nonexistent_migration_test_table`.compile(database.db), ...statements.slice(index + 1)]);
      } };
      await assert.rejects(() => migrateCms(failing), /nonexistent_migration_test_table/);
      assert.deepEqual(await names(database), before);
      await migrateCms(database);
      assert.equal((await database.db.selectFrom('_cms_migrations').selectAll().execute()).length, 2);
    } finally { await database.close(); }
  }
});

test('two independent clean and upgrade callers reach a fully migrated database', async () => {
  for (const upgrade of [false, true]) {
    const dir = await mkdtemp(join(tmpdir(), 'cms-session-race-')); const path = join(dir, 'cms.sqlite');
    const a = openSqlite(path); const b = openSqlite(path);
    try {
      if (upgrade) await v1(a);
      const outcomes = await Promise.allSettled([migrateCms(a), migrateCms(b)]);
      assert.deepEqual(outcomes.map(value => value.status), ['fulfilled', 'fulfilled']);
      await migrateCms(a);
      assert.equal((await a.db.selectFrom('_cms_migrations').selectAll().execute()).length, 2);
      assert.deepEqual(await a.db.selectFrom('_cms_auth_sessions').selectAll().execute(), []);
    } finally { await b.close(); await a.close(); await rm(dir, { recursive: true, force: true }); }
  }
});
