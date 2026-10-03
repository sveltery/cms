import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {FTSManager} from '../src/lib/server/search/fts-manager.ts';
import {CmsError} from '../src/lib/server/database/contract.ts';
import type {Kysely} from 'kysely';
import type {Database} from '../src/lib/server/database/lifecycle/upstream/database/types.ts';
// Original stronger native atomic-conflict requirement, zero source credit.
for(const target of ['Node','D1'] as const)test(`${target}: a concurrent search disable cannot be undone by schema planning`,async()=>{
 const storage=await schemaAdminStorage(target);try{
  const database=storage.database;await migrateCms(database);
  const registry=new SchemaRegistry(database);await registry.createCollection({slug:'notes',label:'Notes',supports:['search']});
  await registry.createField('notes',{slug:'title',label:'Title',type:'string',searchable:true});
  const manager=new FTSManager(database.db as unknown as Kysely<Database>);await manager.enableSearch('notes');
  let raced=false;
  const writer=new SchemaRegistry({...database,async atomicBatch(statements){
   if(!raced){raced=true;await manager.disableSearch('notes');}
   return database.atomicBatch(statements);
  }});
  await assert.rejects(()=>writer.createField('notes',{slug:'body',label:'Body',type:'text',searchable:true}),cause=>cause instanceof CmsError&&cause.code==='CONFLICT');
  assert.equal(await registry.getField('notes','body'),null);
  assert.equal((await manager.getSearchConfig('notes'))?.enabled,false);
  assert.equal(await manager.ftsTableExists('notes'),false);
 }finally{await storage.close();}
});
