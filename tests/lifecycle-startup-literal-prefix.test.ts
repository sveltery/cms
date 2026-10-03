// Original native reserved-prefix review cases; zero source assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import type {CmsDatabase} from '../src/lib/server/database/contract.ts';

for(const target of ['Node','D1'] as const) for(const name of ['acms_tool','xcmsZoperator']) for(const racing of [false,true]) {
  test(`${target}: literal reserved prefix allows ${name} ${racing?'arriving before fresh batch':'already present'}`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      const introduce=async()=>{
        await sql`CREATE TABLE ${sql.id(name)}(note TEXT)`.execute(database.db);
        await sql`INSERT INTO ${sql.id(name)} VALUES('retained')`.execute(database.db);
      };
      if(!racing) await introduce();
      let batches=0;const subject={...database,async atomicBatch(statements:Parameters<CmsDatabase['atomicBatch']>[0]) {
        batches++;if(racing)await introduce();return database.atomicBatch(statements);
      }};
      await assert.doesNotReject(()=>migrateCms(subject));assert.equal(batches,1);
      assert.deepEqual((await sql<{note:string}>`SELECT note FROM ${sql.id(name)}`.execute(database.db)).rows.map(row=>({...row})),[{note:'retained'}]);
      await migrateCms(database);
    } finally {await storage.close();}
  });
}
for(const target of ['Node','D1'] as const) for(const name of ['_cms_partial','_CMS_PARTIAL']) {
  test(`${target}: literal reserved prefix still rejects ${name} without startup writes`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await sql`CREATE TABLE ${sql.id(name)}(note TEXT)`.execute(database.db);
      let batches=0;const subject={...database,async atomicBatch(statements:Parameters<CmsDatabase['atomicBatch']>[0]) {batches++;return database.atomicBatch(statements);}};
      await assert.rejects(()=>migrateCms(subject),{code:'MIGRATION_REQUIRED'});assert.equal(batches,0);
      assert.equal((await sql`SELECT name FROM sqlite_master WHERE name='_cms_migrations'`.execute(database.db)).rows.length,0);
    } finally {await storage.close();}
  });
}
