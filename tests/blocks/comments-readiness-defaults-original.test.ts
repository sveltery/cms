// Supplemental original schema-readiness regressions; zero Source credit.
// Real Node/raw-D1 providers, no identity, request, session or concurrency probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { CMS_MIGRATIONS, migrateCms } from '../../src/lib/server/database/migrations.ts';
import { commentsReady } from '../../src/lib/server/comments/readiness.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';

for (const runtime of ['Node', 'raw D1'] as const) for (const version of [14,15] as const) {
  test(`${runtime}: Comments readiness follows installed${version} creation default and stays read-only`, { timeout: 30_000 }, async () => {
    const worker = runtime === 'raw D1' ? await asyncD1Storage() : undefined;
    const database = worker ? openD1(worker.binding) : openSqlite(':memory:');
    try {
      if (version === 15) await migrateCms(database);
      else {
        await sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.execute(database.db);
        for (const provider of CMS_MIGRATIONS.filter(provider => provider.version <= 14)) {
          await database.atomicBatch([...await provider.statements(database),
            sql`INSERT INTO _cms_migrations(version) VALUES (${provider.version})`.compile(database.db)]);
        }
      }
      const columns = (await sql<{name:string;dflt_value:string|null}>`PRAGMA table_info(_cms_collections)`.execute(database.db)).rows;
      assert.equal(columns.find(column => column.name === 'comments_auto_approve_users')?.dflt_value, version === 15 ? '1' : '0');
      const before = (await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows;
      assert.equal(await commentsReady(database), true);
      assert.deepEqual((await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows, before);
      await database.atomicBatch([
        sql`ALTER TABLE _cms_collections DROP COLUMN comments_auto_approve_users`.compile(database.db),
        sql.raw('ALTER TABLE _cms_collections ADD COLUMN comments_auto_approve_users INTEGER NOT NULL DEFAULT ' + (version === 15 ? '0' : '1')).compile(database.db)
      ]);
      const changed = (await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows;
      assert.equal(await commentsReady(database), false);
      assert.deepEqual((await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows, changed);
    } finally { await database.close(); await worker?.runtime.dispose(); }
  });
}
