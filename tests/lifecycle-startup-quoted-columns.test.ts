// Original configured-review regressions; zero copied-source assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {installVersion4,legacyPost,legacyContentSql,databaseSnapshot} from './helpers/lifecycle-startup.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';

for(const target of ['Node','D1'] as const) for(const {quoted,literalBefore} of [{quoted:true,literalBefore:false},{quoted:true,literalBefore:true},{quoted:false,literalBefore:true}]) {
  test(`${target}: ${quoted?'quoted':'unquoted'} legacy systems ${literalBefore?'with leading literal':'without field literal'} upgrade without rewriting field literals`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installVersion4(database);await legacyPost(database);
      const indexes=(await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='ec_post' AND sql IS NOT NULL`.execute(database.db)).rows;
      let layout=legacyContentSql.replace('author_id TEXT',(literalBefore?"title TEXT DEFAULT 'author_id TEXT', author_id TEXT":"title TEXT, author_id TEXT"));
      if(quoted) layout=layout.replace("status TEXT NOT NULL DEFAULT 'draft' CHECK(status = 'draft')",'"status" TEXT NOT NULL DEFAULT \'draft\' CHECK("status" = \'draft\')')
        .replace(', author_id TEXT',', "author_id" TEXT');
      await database.atomicBatch([sql`DROP TABLE ec_post`.compile(database.db),sql.raw(layout).compile(database.db),...indexes.map(index=>sql.raw(index.sql).compile(database.db))]);
      await sql`INSERT INTO ec_post(id,slug,author_id) VALUES('retained','retained','owner')`.execute(database.db);
      const before=(await sql`SELECT * FROM ec_post`.execute(database.db)).rows;
      await assert.doesNotReject(()=>migrateCms(database));
      const columns=(await sql<{name:string;dflt_value:string|null;type:string;notnull:number}>`PRAGMA table_info(ec_post)`.execute(database.db)).rows;
      assert.equal(columns.find(column=>column.name==='title')?.dflt_value,literalBefore?"'author_id TEXT'":null);
      assert.deepEqual(columns.filter(column=>column.name==='primary_byline_id').map(({type,notnull})=>({type,notnull})),[{type:'TEXT',notnull:0}]);
      const retained=(await sql<Record<string,unknown>>`SELECT * FROM ec_post`.execute(database.db)).rows;
      assert.deepEqual(retained.map(({primary_byline_id,...row})=>row),before);
      assert.equal(retained[0].primary_byline_id,null);
      await sql`UPDATE ec_post SET status='published',primary_byline_id='byline' WHERE id='retained'`.execute(database.db);
      await assert.doesNotReject(()=>migrateCms(database));
      const stable=await databaseSnapshot(database);await migrateCms(database);
      assert.deepEqual(await databaseSnapshot(database),stable);
    } finally {await storage.close();}
  });
}
