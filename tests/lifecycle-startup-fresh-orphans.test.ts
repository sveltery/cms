// Original PR #42 review regressions; zero EmDash assertion/declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { databaseSnapshot } from './helpers/lifecycle-startup.ts';

for (const target of ['Node','D1'] as const) {
  for (const mode of ['existing-table','existing-view','race-table'] as const) {
    test(`${target}: ${mode} rejects fresh orphan content without migration writes`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;
        const createOrphan=async () => {
          if (mode==='existing-view') {
            await sql`CREATE VIEW ec_orphan AS SELECT 'retained' AS retained`.execute(database.db);
          } else {
            await sql`CREATE TABLE ec_orphan (retained TEXT)`.execute(database.db);
            await sql`INSERT INTO ec_orphan VALUES ('retained')`.execute(database.db);
          }
        };
        if (mode!=='race-table') await createOrphan();
        let before=await databaseSnapshot(database);
        const subject=mode==='race-table' ? {
          ...database,
          async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
            // The other writer commits after preflight but before our batch.
            await createOrphan();
            before=await databaseSnapshot(database);
            return database.atomicBatch(statements);
          }
        } : database;
        let result:unknown='success';
        try {await migrateCms(subject);} catch (cause) {result=(cause as {code?:unknown}).code;}
        const after=await databaseSnapshot(database);
        let reopened:unknown='success';
        try {await migrateCms(database);} catch (cause) {reopened=(cause as {code?:unknown}).code;}
        assert.equal(result,'MIGRATION_REQUIRED');
        assert.deepEqual(after,before);
        assert.equal(reopened,'MIGRATION_REQUIRED');
        assert.deepEqual(await databaseSnapshot(database),before);
      } finally {await storage.close();}
    });
  }
}
