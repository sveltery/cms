import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {CMS_MIGRATIONS,migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';

test('taxonomy migration rejects a concurrent collection omitted from its index plan',async()=>{
 const database=openSqlite(':memory:');try{
  const statements=[sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.compile(database.db)];
  for(const provider of CMS_MIGRATIONS.filter(provider=>provider.version<7))statements.push(...await provider.statements(database),sql`INSERT INTO _cms_migrations(version) VALUES (${provider.version})`.compile(database.db));
  await database.atomicBatch(statements);
  const registry=new SchemaRegistry(database);await registry.createCollection({slug:'existing',label:'Existing'});
  const original=database.atomicBatch.bind(database);let raced=false;
  const concurrent={...database,atomicBatch:async (queries:any)=>{if(!raced){raced=true;await registry.createCollection({slug:'arrived',label:'Arrived'});}return original(queries);}};
  await assert.rejects(migrateCms(concurrent),error=>error instanceof Error&&(error as any).code==='MIGRATION_REQUIRED');
  assert.equal((await sql<{version:number}>`SELECT max(version) AS version FROM _cms_migrations`.execute(database.db)).rows[0].version,6);
  assert.equal((await sql<{name:string}>`SELECT name FROM sqlite_master WHERE name='taxonomies'`.execute(database.db)).rows.length,0);
  await migrateCms(database);
  assert.equal((await sql<{name:string}>`SELECT name FROM sqlite_master WHERE name='idx_ec_arrived_del_tg_locale'`.execute(database.db)).rows.length,1);
 }finally{await database.close();}
});
