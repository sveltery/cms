// Original PR #42 configured/independent review regressions; zero source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { databaseSnapshot, installVersion4, legacyPost } from './helpers/lifecycle-startup.ts';

for (const target of ['Node','D1'] as const) {
  for (const mode of ['table','view','race-table'] as const) {
    test(`${target}: uppercase orphan ${mode} rejects without migration writes`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;
        const createOrphan=async () => {
          if (mode==='view') await sql`CREATE VIEW EC_ORPHAN AS SELECT 'operator data' AS retained`.execute(database.db);
          else {
            await sql`CREATE TABLE EC_ORPHAN (retained TEXT)`.execute(database.db);
            await sql`INSERT INTO EC_ORPHAN VALUES ('operator data')`.execute(database.db);
          }
        };
        if (mode!=='race-table') await createOrphan();
        let before=await databaseSnapshot(database);
        const subject=mode==='race-table' ? {...database,
          async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
            await createOrphan(); before=await databaseSnapshot(database);
            return database.atomicBatch(statements);
          }
        } : database;
        let result:unknown='success';
        try {await migrateCms(subject);} catch (cause) {result=(cause as {code?:unknown}).code;}
        const after=await databaseSnapshot(database);
        assert.equal(result,'MIGRATION_REQUIRED');
        assert.deepEqual(after,before);
        await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'});
        assert.deepEqual(await databaseSnapshot(database),before);
      } finally {await storage.close();}
    });
  }

  for (const layout of ['fresh','v4'] as const) {
    test(`${target}: ${layout} preserves an unrelated operator FK with an ec_note column`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;
        if (layout==='v4') {
          await installVersion4(database); await legacyPost(database);
          await sql`INSERT INTO _cms_auth_users VALUES ('owner',30,0)`.execute(database.db);
          await sql`CREATE TABLE operator_links (ec_note TEXT, user_id TEXT REFERENCES _cms_auth_users(id))`.execute(database.db);
        } else {
          await sql`CREATE TABLE operator_users (id TEXT PRIMARY KEY)`.execute(database.db);
          await sql`INSERT INTO operator_users VALUES ('owner')`.execute(database.db);
          await sql`CREATE TABLE operator_links (ec_note TEXT, user_id TEXT REFERENCES operator_users(id))`.execute(database.db);
        }
        await sql`INSERT INTO operator_links VALUES ('operator data','owner')`.execute(database.db);
        const before=await databaseSnapshot(database);
        let result:unknown='success';
        try {await migrateCms(database);} catch (cause) {result=(cause as {code?:unknown}).code;}
        const after=await databaseSnapshot(database);
        assert.equal(result,'success');
        for (const table of before.tables.filter(row=>row.name.startsWith('operator_'))) {
          assert.deepEqual(after.tables.find(row=>row.name===table.name),table);
        }
        for (const object of before.objects.filter(row=>row.name.startsWith('operator_'))) {
          assert.deepEqual(after.objects.find(row=>row.name===object.name),object);
        }
        await migrateCms(database);
      } finally {await storage.close();}
    });
  }
}
