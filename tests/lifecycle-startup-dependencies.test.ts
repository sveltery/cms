// Original PR #42 operator-dependency review regressions; zero source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { databaseSnapshot, installVersion4, legacyPost } from './helpers/lifecycle-startup.ts';

for (const target of ['Node','D1'] as const) {
  for (const kind of ['view','external-trigger'] as const) {
    for (const timing of ['preinstalled','race'] as const) {
      test(`${target}: ${timing} ${kind} content dependency rejects without writes`, async () => {
        const storage=await schemaAdminStorage(target);
        try {
          const database=storage.database;
          await installVersion4(database); await legacyPost(database);
          await sql`INSERT INTO ec_post (id,title) VALUES ('retained','Retained')`.execute(database.db);
          await sql`CREATE TABLE operator_events (entry_id TEXT)`.execute(database.db);
          await sql`INSERT INTO operator_events VALUES ('retained')`.execute(database.db);
          const createDependency=async () => {
            if (kind==='view') await sql`CREATE VIEW operator_posts AS SELECT * FROM ec_post`.execute(database.db);
            else await sql`CREATE TRIGGER operator_trigger AFTER INSERT ON operator_events BEGIN SELECT id FROM ec_post; END`.execute(database.db);
          };
          if (timing==='preinstalled') await createDependency();
          let before=await databaseSnapshot(database);
          let batches=0;
          const subject={...database,
            async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
              batches++;
              if (timing==='race') {await createDependency(); before=await databaseSnapshot(database);}
              return database.atomicBatch(statements);
            }
          };
          let result:unknown='success';
          try {await migrateCms(subject);} catch (cause) {
            result=(cause as {code?:unknown;message?:unknown}).code ?? (cause as {message?:unknown}).message;
          }
          assert.deepEqual(await databaseSnapshot(database),before);
          assert.equal(result,'MIGRATION_REQUIRED');
          assert.equal(batches,timing==='preinstalled' ? 0 : 1);
        } finally {await storage.close();}
      });
    }
  }
}
