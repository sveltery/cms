import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {ordinaryContentService} from '../src/lib/server/database/content-service.ts';
import {registerLifecycleDatabase} from '../src/lib/server/database/lifecycle/upstream/host.ts';
import {ContentRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {FTSManager} from '../src/lib/server/search/fts-manager.ts';
import type {Database} from '../src/lib/server/database/lifecycle/upstream/database/types.ts';
import type {Kysely} from 'kysely';
for(const target of ['Node','D1'] as const) test(`${target}: real ordinary list and count accept and apply search q`,async()=>{
 const storage=await schemaAdminStorage(target);try{
  const database=storage.database;await migrateCms(database);registerLifecycleDatabase(database);
  const registry=new SchemaRegistry(database);await registry.createCollection({slug:'posts',label:'Posts',supports:['search']});
  await registry.createField('posts',{slug:'title',label:'Title',type:'string',searchable:true});
  const db=database.db as unknown as Kysely<Database>,repository=new ContentRepository(db);
  const needle=await repository.create({type:'posts',slug:'needle-post',data:{title:'Needle Headline'}});
  await repository.create({type:'posts',slug:'ordinary-post',data:{title:'Ordinary Headline'}});
  await new FTSManager(db).enableSearch('posts');
  const service=ordinaryContentService(database,{id:'admin',permissions:['content:read','content:read_drafts']});
  await assert.doesNotReject(async()=>{
   const result=await service.listContent({type:'posts',q:'need head'});
   assert.deepEqual(result.items.map(item=>item.id),[needle.id]);
   assert.equal(result.total,1);
   assert.equal(await service.countContent({type:'posts',q:'need head'}),1);
  });
 }finally{await storage.close();}
});
