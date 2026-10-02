// Supplemental migration/index evidence; zero upstream assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms, CMS_MIGRATION_VERSION } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { CmsError, type CmsDatabase } from '../src/lib/server/database/contract.ts';

const versionOne = JSON.parse(readFileSync(new URL('./fixtures/cms-v1.json', import.meta.url), 'utf8')) as string[];
async function fixture(target: 'Node' | 'D1', version: 1 | 2) {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-index-migration-'));
  const storage = await collectionUpdateStorage(target, directory);
  const database = storage.database;
  if (version === 1) for (const statement of versionOne) await sql.raw(statement).execute(database.db);
  else await migrateCms(database);
  const registry = new SchemaRegistry(database); const entries = new DraftRepository(database);
  await registry.createCollection({ slug: 'posts', label: 'Retained posts' });
  await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
  const row = await entries.create({ type: 'posts', locale: 'fr', slug: 'retained', data: { title: 'Retained' } }, 'owner');
  await entries.delete({ type: 'posts', id: row.id, locale: 'fr', expected: { version: row.version, updatedAt: row.updatedAt } });
  await sql`DROP INDEX idx_ec_posts_deleted_status`.execute(database.db);
  const competitor = target === 'Node' ? openSqlite(join(directory, 'cms.sqlite')) : database;
  return { database, competitor, entries, row, directory, async close() {
    if (competitor !== database) await competitor.close();
    await storage.close(); await rm(directory, { recursive: true, force: true });
  } };
}
async function snapshot(database: CmsDatabase) {
  const objects = (await sql<{ name: string; type: string; sql: string }>`SELECT name, type, sql FROM sqlite_master
    WHERE name != '_cf_METADATA' ORDER BY name`.execute(database.db)).rows;
  const tables = [];
  for (const object of objects.filter(object => object.type === 'table' && !object.name.startsWith('sqlite_'))) {
    tables.push({ name: object.name, rows: (await sql`SELECT * FROM ${sql.ref(object.name)} ORDER BY rowid`.execute(database.db)).rows });
  }
  return { objects, tables };
}
const object = async (database: CmsDatabase, name: string) =>
  (await sql<{ type: string; sql: string }>`SELECT type, sql FROM sqlite_master WHERE name = ${name}`.execute(database.db)).rows[0];

for (const target of ['Node', 'D1'] as const) {
  for (const version of [1, 2] as const) {
    test(`${target}: concurrent v${version} trash index installers preserve rows and reach complete v2`, { timeout: 30000 }, async () => {
      const f = await fixture(target, version);
      try {
        const before = (await sql`SELECT * FROM ec_posts`.execute(f.database.db)).rows;
        let arrivals = 0; let release!: () => void;
        const ready = new Promise<void>(resolve => { release = resolve; });
        const concurrent = (database: CmsDatabase): CmsDatabase => ({ ...database, async atomicBatch(statements) {
          assert.ok(statements.some(statement => statement.sql.includes('idx_ec_posts_deleted_status')));
          arrivals++; if (arrivals === 2) release(); await ready;
          return database.atomicBatch(statements);
        } });
        const outcomes = await Promise.allSettled([migrateCms(concurrent(f.database)), migrateCms(concurrent(f.competitor))]);
        assert.equal(arrivals, 2, 'both installers complete absent-index preflight before either batch');
        assert.deepEqual(outcomes.map(outcome => outcome.status), ['fulfilled', 'fulfilled'], JSON.stringify(outcomes));
        assert.match((await object(f.database, 'idx_ec_posts_deleted_status')).sql, /\(deleted_at, status\)/);
        assert.deepEqual((await sql`SELECT * FROM ec_posts`.execute(f.database.db)).rows, before);
        assert.deepEqual((await f.database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row => row.version), Array.from({length:CMS_MIGRATION_VERSION},(_,index)=>index+1));
        assert.deepEqual(await f.database.db.selectFrom('_cms_auth_users').selectAll().execute(), []);
        assert.deepEqual(await f.database.db.selectFrom('_cms_auth_sessions').selectAll().execute(), []);
        assert.deepEqual(await f.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
      } finally { await f.close(); }
    });

    test(`${target}: v${version} wrong same-name objects reject migration without mutation`, { timeout: 30000 }, async () => {
      for (const statement of ['CREATE TABLE idx_ec_posts_deleted_status (retained TEXT)',
        'CREATE VIEW idx_ec_posts_deleted_status AS SELECT id FROM ec_posts',
        'CREATE INDEX idx_ec_posts_deleted_status ON ec_posts(locale)',
        "CREATE INDEX idx_ec_posts_deleted_status ON ec_posts(deleted_at DESC, status)"]) {
        const f = await fixture(target, version);
        try {
          await sql.raw(statement).execute(f.database.db);
          const before = await snapshot(f.database);
          await assert.rejects(() => migrateCms(f.database), { code: 'MIGRATION_REQUIRED' });
          assert.deepEqual(await snapshot(f.database), before);
        } finally { await f.close(); }
      }
    });

    test(`${target}: v${version} incompatible index appearing after preflight rejects and rolls back installer changes`, { timeout: 30000 }, async () => {
      const f = await fixture(target, version); let winnerSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined; let raced = false;
      try {
        const interposed: CmsDatabase = { ...f.database, async atomicBatch(statements) {
          assert.ok(statements.some(statement => statement.sql.includes('idx_ec_posts_deleted_status')));
          raced = true;
          await sql`CREATE INDEX idx_ec_posts_deleted_status ON ec_posts(locale)`.execute(f.competitor.db);
          winnerSnapshot = await snapshot(f.competitor);
          return f.database.atomicBatch(statements);
        } };
        let failure: unknown;
        await assert.rejects(() => migrateCms(interposed), cause => { failure = cause; return cause instanceof Error; });
        assert.equal(raced, true); assert.ok(winnerSnapshot);
        assert.deepEqual(await snapshot(f.database), winnerSnapshot);
        assert.deepEqual(await f.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
        assert.ok(failure instanceof CmsError, 'the incompatible-index guard has a domain migration error');
        assert.equal(failure.code, 'MIGRATION_REQUIRED');
      } finally { await f.close(); }
    });
  }

  test(`${target}: v1 trash index batch failure rolls back auth DDL, marker upgrade and index together`, { timeout: 30000 }, async () => {
    const f = await fixture(target, 1);
    try {
      const before = await snapshot(f.database);
      const failing: CmsDatabase = { ...f.database, async atomicBatch(statements) {
        const index = statements.findIndex(statement => statement.sql.includes('CREATE INDEX IF NOT EXISTS') && statement.sql.includes('idx_ec_posts_deleted_status'));
        assert.ok(index >= 0, 'failure follows the actual trash index creation statement');
        return f.database.atomicBatch([...statements.slice(0, index + 1),
          sql`SELECT * FROM nonexistent_trash_upgrade_failure`.compile(f.database.db), ...statements.slice(index + 1)]);
      } };
      await assert.rejects(() => migrateCms(failing), /nonexistent_trash_upgrade_failure/);
      assert.deepEqual(await snapshot(f.database), before);
      assert.equal(await object(f.database, '_cms_auth_users'), undefined);
      assert.equal(await object(f.database, '_cms_auth_sessions'), undefined);
      assert.equal(await object(f.database, '_cms_migrations_v1'), undefined);
      assert.equal(await object(f.database, 'idx_ec_posts_deleted_status'), undefined);
      await migrateCms(f.database); assert.equal((await object(f.database, 'idx_ec_posts_deleted_status')).type, 'index');
    } finally { await f.close(); }
  });

  test(`${target}: invalid known auth states reject before any trash index installer batch`, { timeout: 30000 }, async () => {
    for (const state of ['v1-auth', 'v2-missing-index', 'v2-malformed-users'] as const) {
      const f = await fixture(target, state === 'v1-auth' ? 1 : 2); let batches = 0;
      try {
        if (state === 'v1-auth') await sql`CREATE TABLE _cms_auth_users (id TEXT)`.execute(f.database.db);
        if (state === 'v2-missing-index') await sql`DROP INDEX idx_cms_auth_sessions_user`.execute(f.database.db);
        if (state === 'v2-malformed-users') await sql`ALTER TABLE _cms_auth_users RENAME COLUMN role TO wrong_role`.execute(f.database.db);
        const before = await snapshot(f.database);
        const observing: CmsDatabase = { ...f.database, async atomicBatch(statements) { batches++; return f.database.atomicBatch(statements); } };
        await assert.rejects(() => migrateCms(observing), { code: 'MIGRATION_REQUIRED' });
        assert.equal(batches, 0); assert.equal(await object(f.database, 'idx_ec_posts_deleted_status'), undefined);
        assert.deepEqual(await snapshot(f.database), before);
      } finally { await f.close(); }
    }
  });

  test(`${target}: backfilled existing index and retained trash survive storage restart with unchanged schema metadata`, { timeout: 30000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-trash-index-restart-'));
    let storage = await collectionUpdateStorage(target, directory);
    try {
      for (const statement of versionOne) await sql.raw(statement).execute(storage.database.db);
      const registry = new SchemaRegistry(storage.database); const entries = new DraftRepository(storage.database);
      await registry.createCollection({ slug: 'posts', label: 'Retained' });
      await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
      const row = await entries.create({ type: 'posts', locale: 'fr', data: { title: 'Persisted' } }, 'owner');
      await entries.delete({ type: 'posts', id: row.id, locale: 'fr', expected: { version: row.version, updatedAt: row.updatedAt } });
      await sql`DROP INDEX idx_ec_posts_deleted_status`.execute(storage.database.db);
      const schema = await registry.getCollectionWithFields('posts');
      const trash = await entries.findTrashedById('posts', row.id);
      await migrateCms(storage.database); const migrated = await snapshot(storage.database);
      await storage.close(); storage = await collectionUpdateStorage(target, directory);
      await migrateCms(storage.database);
      assert.deepEqual(await snapshot(storage.database), migrated);
      assert.deepEqual(await new SchemaRegistry(storage.database).getCollectionWithFields('posts'), schema);
      assert.deepEqual(await new DraftRepository(storage.database).findTrashedById('posts', row.id), trash);
      assert.equal((await object(storage.database, 'idx_ec_posts_deleted_status')).type, 'index');
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });
}
