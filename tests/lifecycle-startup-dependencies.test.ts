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

  test(`${target}: qualified, joined, grouped and mutating content dependencies reject unchanged`, async () => {
    for (const definition of [
      'CREATE VIEW operator_posts AS SELECT id FROM main."EC_POST"',
      'CREATE VIEW operator_posts AS SELECT ec_post.id FROM operator_events, /* dependency */ ec_post',
      'CREATE VIEW operator_posts AS SELECT ec_post.id FROM (operator_events CROSS JOIN [ec_post])',
      'CREATE VIEW operator_posts AS WITH retained AS (SELECT id FROM ec_post) SELECT * FROM retained',
      "CREATE TRIGGER operator_trigger AFTER INSERT ON operator_events BEGIN UPDATE OR IGNORE ec_post SET title='Changed'; END",
      "CREATE TRIGGER operator_trigger AFTER INSERT ON operator_events BEGIN INSERT INTO ec_post (id,title) VALUES ('dependent','Dependency'); END",
      'CREATE TRIGGER operator_trigger AFTER INSERT ON operator_events BEGIN DELETE FROM ec_post WHERE id=new.entry_id; END'
    ]) {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;
        await installVersion4(database); await legacyPost(database);
        await sql`INSERT INTO ec_post (id,title) VALUES ('retained','Retained')`.execute(database.db);
        await sql`CREATE TABLE operator_events (entry_id TEXT)`.execute(database.db);
        await sql.raw(definition).execute(database.db);
        const before=await databaseSnapshot(database);
        await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'},definition);
        assert.deepEqual(await databaseSnapshot(database),before,definition);
      } finally {await storage.close();}
    }
  });

  test(`${target}: unrelated operator views, triggers, CTE names, literals and comments remain unchanged`, async () => {
    const storage=await schemaAdminStorage(target);
    try {
      const database=storage.database;
      await installVersion4(database); await legacyPost(database);
      await sql`INSERT INTO ec_post (id,title) VALUES ('retained','Retained')`.execute(database.db);
      await sql`CREATE TABLE operator_events (entry_id TEXT, ec_note TEXT)`.execute(database.db);
      await sql`INSERT INTO operator_events VALUES ('operator-row','retained')`.execute(database.db);
      await sql.raw("CREATE VIEW operator_notes AS SELECT ec_note, 'FROM ec_post '' literal' AS note FROM operator_events /* JOIN ec_post */").execute(database.db);
      await sql`CREATE VIEW operator_cte AS WITH ec_post AS (SELECT entry_id FROM operator_events) SELECT * FROM ec_post`.execute(database.db);
      await sql.raw("CREATE TRIGGER operator_trigger AFTER INSERT ON operator_events BEGIN SELECT 'FROM ec_post' /* UPDATE ec_post */; UPDATE operator_events SET ec_note='ec_post' WHERE entry_id=new.entry_id; END").execute(database.db);
      const before=await databaseSnapshot(database);
      await migrateCms(database); await migrateCms(database);
      const after=await databaseSnapshot(database);
      for (const table of before.tables.filter(row=>row.name.startsWith('operator_'))) {
        assert.deepEqual(after.tables.find(row=>row.name===table.name),table);
      }
      for (const object of before.objects.filter(row=>row.name.startsWith('operator_'))) {
        assert.deepEqual(after.objects.find(row=>row.name===object.name),object);
      }
      assert.deepEqual((await sql`SELECT * FROM operator_cte`.execute(database.db)).rows.map(row=>({...row})),[{entry_id:'operator-row'}]);
    } finally {await storage.close();}
  });
}
