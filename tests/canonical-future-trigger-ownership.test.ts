// Original finite declared-DDL ownership requirement, zero Source credit.
// One actual storage binding and one trigger added before the existing batch;
// no authenticated principal, sessions, protected family or concurrent callers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { canonicalStorage, storageTargets } from './helpers/canonical-installation/storage.ts';
import { installCanonicalPublicVersion5 } from './helpers/canonical-installation/public-v5.ts';
import { databaseSnapshot } from './helpers/lifecycle-startup.ts';

for (const target of storageTargets) for (const spelling of ['lowercase','uppercase'] as const) {
  test(`${target}: a ${spelling} declared future trigger refuses startup before any write`, {timeout:30_000}, async () => {
    const h = await canonicalStorage(target);
    try {
      await installCanonicalPublicVersion5(h.database);
      await sql`CREATE TABLE operator_future_trigger(value TEXT)`.execute(h.database.db);
      await sql`INSERT INTO operator_future_trigger VALUES ('retained')`.execute(h.database.db);
      const name = spelling === 'lowercase' ? '_cms_options_revision_insert' : '_CMS_OPTIONS_REVISION_INSERT';
      let before: Awaited<ReturnType<typeof databaseSnapshot>> | undefined;
      let batches = 0;
      const subject: CmsDatabase = { db:h.database.db,close:() => h.database.close(),
        async atomicBatch(statements) {
          batches++;
          await sql`CREATE TRIGGER ${sql.id(name)} AFTER INSERT ON operator_future_trigger
            BEGIN SELECT 'ordinary declared-DDL fixture'; END`.execute(h.database.db);
          before = await databaseSnapshot(h.database);
          return h.database.atomicBatch(statements);
        }
      };
      let result: unknown = 'success';
      try { await migrateCms(subject); }
      catch (cause) { result=(cause as {code?:unknown;message?:unknown}).code ?? (cause as {message?:unknown}).message; }
      assert.equal(result,'MIGRATION_REQUIRED');
      assert.equal(batches,1);
      assert.ok(before);
      assert.deepEqual(await databaseSnapshot(h.database),before);
    } finally { await h.close(); }
  });
}
