// Original native schema assertions; real Node SQLite and raw workerd D1.
// These are storage checks, with no session/signature/identity probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { commentsReady } from '../src/lib/server/comments/readiness.ts';
import { commentSchemaSql } from '../src/lib/server/comments/migrations.ts';
import { asyncD1Storage } from './helpers/async-d1-storage.ts';

for (const target of ['Node SQLite', 'raw D1'] as const) {
  for (const variant of ['correct', 'default case', 'default whitespace', 'partial index case', 'collection default case', 'source auto approval default'] as const) {
    test(`comments ${target} readiness preserves SQL literals: ${variant}`, { timeout: 30000 }, async () => {
      const worker = target === 'raw D1' ? await asyncD1Storage() : undefined;
      const database = worker ? openD1(worker.binding) : openSqlite(':memory:');
      try {
        await migrateCms(database);
        const statements = commentSchemaSql.map(statement => {
          if (variant === 'default case') return statement.replace("DEFAULT 'pending'", "DEFAULT 'PENDING'");
          if (variant === 'default whitespace') return statement.replace("DEFAULT 'pending'", "DEFAULT 'pend ing'");
          if (variant === 'partial index case') return statement.replace("WHERE status = 'pending'", "WHERE status = 'PENDING'");
          return statement;
        });
        await database.atomicBatch([
          ...statements.map(statement => sql.raw(statement).compile(database.db)),
          ...(variant === 'collection default case' ? [
            sql`ALTER TABLE _cms_collections DROP COLUMN comments_moderation`.compile(database.db),
            sql`ALTER TABLE _cms_collections ADD COLUMN comments_moderation TEXT DEFAULT 'FIRST_TIME'`.compile(database.db)
          ] : variant === 'source auto approval default' ? [
            sql`ALTER TABLE _cms_collections DROP COLUMN comments_auto_approve_users`.compile(database.db),
            sql`ALTER TABLE _cms_collections ADD COLUMN comments_auto_approve_users INTEGER DEFAULT 1`.compile(database.db)
          ] : [])
        ]);
        const before = (await sql`SELECT name, sql FROM sqlite_schema ORDER BY name`.execute(database.db)).rows;
        assert.equal(await commentsReady(database), variant === 'correct');
        assert.deepEqual((await sql`SELECT name, sql FROM sqlite_schema ORDER BY name`.execute(database.db)).rows, before);
      } finally {
        await database.close();
        await worker?.runtime.dispose();
      }
    });
  }
}
