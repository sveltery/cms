import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {FTSManager} from '../src/lib/server/search/fts-manager.ts';
import {CmsError} from '../src/lib/server/database/contract.ts';
import {sql} from 'kysely';
import {searchWithDb} from '../src/lib/server/search/query.ts';
import {CompiledQuery} from 'kysely';
import {readFile} from 'node:fs/promises';
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
for(const target of ['Node','D1'] as const)test(`${target}: ordinary immutable v1 fields remain writable before search metadata exists`,async()=>{
 const storage=await schemaAdminStorage(target);try{
  const database=storage.database;
  const statements=JSON.parse(await readFile(new URL('./fixtures/cms-v1.json',import.meta.url),'utf8')) as string[];
  await database.atomicBatch(statements.map(statement=>CompiledQuery.raw(statement)));
  const registry=new SchemaRegistry(database);await registry.createCollection({slug:'legacy',label:'Legacy'});
  await assert.doesNotReject(()=>registry.createField('legacy',{slug:'title',label:'Title',type:'string'}));
  assert.equal((await registry.getField('legacy','title'))?.label,'Title');
  assert.equal((await sql<{name:string}>`PRAGMA table_info(_cms_collections)`.execute(database.db)).rows.some(row=>row.name==='search_config'),false);
 }finally{await storage.close();}
});
for(const target of ['Node','D1'] as const)test(`${target}: an index rebuild binds the exact fields used for projection`,async()=>{
 const storage=await schemaAdminStorage(target);try{
  const database=storage.database;await migrateCms(database);const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'notes',label:'Notes',supports:['search']});
  await registry.createField('notes',{slug:'title',label:'Title',type:'string',searchable:true});
  await registry.createField('notes',{slug:'body',label:'Body',type:'text',searchable:false});
  const db=database.db as unknown as Kysely<Database>,manager=new FTSManager(db);await manager.enableSearch('notes');
  await sql`INSERT INTO ec_notes(id,slug,status,title,body) VALUES('post','post','published','Example','Needle')`.execute(db);
  let raced=false;
  class StaleProjection extends SchemaRegistry {
   override async listFields(collectionId:string){
    const fields=await super.listFields(collectionId);
    if(!raced){raced=true;await registry.updateField('notes','body',{searchable:true});}
    return fields;
   }
  }
  await assert.rejects(()=>new StaleProjection(database).updateField('notes','title',{searchable:false}),cause=>cause instanceof CmsError&&cause.code==='CONFLICT');
  assert.equal((await registry.getField('notes','title'))?.label,'Title');
  assert.equal((await registry.getField('notes','title'))?.searchable,true);
  assert.equal((await registry.getField('notes','body'))?.searchable,true);
  assert.deepEqual((await searchWithDb(db,'Needle')).items.map(row=>row.id),['post']);
 }finally{await storage.close();}
});
for(const target of ['Node','D1'] as const)for(const kind of ['field','collection'] as const)test(`${target}: a ${kind} label edit preserves a valid public-helper enabled index without supports`,async()=>{
 const storage=await schemaAdminStorage(target);try{
  const database=storage.database;await migrateCms(database);const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'notes',label:'Notes',supports:[]});
  await registry.createField('notes',{slug:'title',label:'Title',type:'string',searchable:true});
  const manager=new FTSManager(database.db as unknown as Kysely<Database>);await manager.enableSearch('notes');
  if(kind==='field')await registry.updateField('notes','title',{label:'Renamed title'});
  else await registry.updateCollection('notes',{label:'Renamed notes'});
  assert.equal((await manager.getSearchConfig('notes'))?.enabled,true);
  assert.equal(await manager.ftsTableExists('notes'),true);
 }finally{await storage.close();}
});
for(const target of ['Node','D1'] as const)for(const state of ['unconfigured','disabled'] as const)test(`${target}: concurrent enable cannot leave a ${state} schema change outside the live index`,async()=>{
 const storage=await schemaAdminStorage(target);try{
  const database=storage.database;await migrateCms(database);
  const registry=new SchemaRegistry(database);await registry.createCollection({slug:'notes',label:'Notes',supports:['search']});
  await registry.createField('notes',{slug:'title',label:'Title',type:'string',searchable:true});
  const manager=new FTSManager(database.db as unknown as Kysely<Database>);
  if(state==='disabled'){await manager.enableSearch('notes');await manager.disableSearch('notes');}
  let raced=false;
  const writer=new SchemaRegistry({...database,async atomicBatch(statements){
   if(!raced){raced=true;await manager.enableSearch('notes');}
   return database.atomicBatch(statements);
  }});
  await assert.rejects(()=>writer.createField('notes',{slug:'body',label:'Body',type:'text',searchable:true}),cause=>cause instanceof CmsError&&cause.code==='CONFLICT');
  assert.equal(await registry.getField('notes','body'),null);
  assert.equal((await manager.getSearchConfig('notes'))?.enabled,true);
  assert.equal(await manager.ftsTableExists('notes'),true);
  assert.deepEqual(await manager.getSearchableFields('notes'),['title']);
 }finally{await storage.close();}
});
