// Original PR #42 final-review regressions; zero copied-source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { databaseSnapshot, installVersion4, legacyContentSql } from './helpers/lifecycle-startup.ts';

for (const target of ['Node','D1'] as const) {
  for (const direction of ['forward','reverse','unchanged-owner'] as const) {
    test(`${target}: ${direction} cross-collection and self-reference triggers survive the complete rebuild`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;
        await installVersion4(database);
        const registry=new SchemaRegistry(database);
        for (const slug of ['a','b']) {
          await registry.createCollection({slug,label:slug});
          if (!(direction==='unchanged-owner'&&slug==='a')) await database.atomicBatch([
            sql.raw(`DROP TABLE ec_${slug}`).compile(database.db),
            sql.raw(legacyContentSql.replace('CREATE TABLE ec_post',`CREATE TABLE ec_${slug}`)).compile(database.db)
          ]);
          await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
          await sql.raw(`INSERT INTO ec_${slug} (id,title) VALUES ('retained-${slug}','Retained ${slug}')`).execute(database.db);
        }
        const owner=direction==='reverse' ? 'b' : 'a';
        const destination=owner==='a' ? 'b' : 'a';
        await sql.raw(`CREATE TRIGGER cross_collection AFTER INSERT ON ec_${owner}
          BEGIN INSERT INTO ec_${destination} (id,title) VALUES ('copy-'||NEW.id,NEW.title); END`).execute(database.db);
        await sql`CREATE TRIGGER self_reference AFTER UPDATE OF title ON ec_a
          BEGIN UPDATE ec_a SET author_id='triggered' WHERE id=NEW.id; END`.execute(database.db);
        await sql`CREATE TABLE operator_events (entry_id TEXT)`.execute(database.db);
        await sql`CREATE TRIGGER operator_trigger AFTER INSERT ON operator_events
          BEGIN UPDATE operator_events SET entry_id='operator-'||NEW.entry_id WHERE rowid=NEW.rowid; END`.execute(database.db);
        const before=await databaseSnapshot(database);

        await assert.doesNotReject(()=>migrateCms(database));
        const after=await databaseSnapshot(database);
        assert.deepEqual(after.objects.filter(row=>row.type==='trigger'),before.objects.filter(row=>row.type==='trigger'));
        for (const name of ['ec_a','ec_b']) {
          const withoutByline=(rows:unknown[]|undefined)=>rows?.map(row=>{
            const retained={...(row as Record<string,unknown>)}; delete retained.primary_byline_id; return retained;
          });
          assert.deepEqual(withoutByline(after.tables.find(row=>row.name===name)?.rows),
            withoutByline(before.tables.find(row=>row.name===name)?.rows));
        }
        await sql.raw(`INSERT INTO ec_${owner} (id,title) VALUES ('new-entry','Copied after upgrade')`).execute(database.db);
        assert.equal((await sql.raw<{title:string}>(`SELECT title FROM ec_${destination} WHERE id='copy-new-entry'`).execute(database.db)).rows[0]?.title,'Copied after upgrade');
        await sql`UPDATE ec_a SET title='Self after upgrade' WHERE id='retained-a'`.execute(database.db);
        assert.equal((await sql<{author_id:string}>`SELECT author_id FROM ec_a WHERE id='retained-a'`.execute(database.db)).rows[0]?.author_id,'triggered');
        await sql`INSERT INTO operator_events VALUES ('retained')`.execute(database.db);
        assert.equal((await sql<{entry_id:string}>`SELECT entry_id FROM operator_events`.execute(database.db)).rows[0]?.entry_id,'operator-retained');
        const settled=await databaseSnapshot(database);
        await assert.doesNotReject(()=>migrateCms(database));
        assert.deepEqual(await databaseSnapshot(database),settled);
      } finally {await storage.close();}
    });
  }
}
