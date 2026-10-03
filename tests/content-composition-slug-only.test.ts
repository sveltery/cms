// Original native composition regressions; zero copied Source declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService, type ServerPrincipal} from '../src/lib/server/database/service.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';

const actor:ServerPrincipal={id:'slug-review-admin',permissions:['content:read','content:read_drafts','content:create','content:edit_any','content:publish_any']};
const expected=(item:{version:number;updatedAt:string})=>({version:item.version,updatedAt:item.updatedAt});
for(const target of ['Node','D1'] as const)for(const explicitData of [false,true])test(`${target}: ordinary ${explicitData?'explicit empty-data save stages a slug':'slug-only save changes live metadata without a draft'}`,async()=>{
 const storage=await schemaAdminStorage(target);
 try{
  const database=storage.database;await migrateCms(database);const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'post',label:'Posts'});await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const ordinary=cmsService(database,actor,{after:()=>{}}),lifecycle=lifecycleService(database,actor,{after:()=>{}});
  const created=await ordinary.createContent({type:'post',slug:'original-live',data:{title:'Published title'}});
  const published=await lifecycle.publish({type:'post',id:created.id});
  const history=await database.db.selectFrom('_cms_revisions').selectAll().orderBy('id').execute();
  let saved:Awaited<ReturnType<typeof ordinary.updateContent>>|undefined;
  await assert.doesNotReject(async()=>{saved=await ordinary.updateContent({type:'post',id:created.id,slug:'new-slug',expected:expected(published),...(explicitData?{data:{}}:{})});});
  assert.ok(saved);
  assert.equal(saved.slug,explicitData?'original-live':'new-slug');
  assert.equal(saved.liveRevisionId,published.liveRevisionId);assert.equal(saved.version,published.version+1);
  assert.deepEqual(saved.data,{title:'Published title'});
  if(explicitData){
   assert.ok(saved.draftRevisionId);assert.deepEqual(saved.liveData,{title:'Published title'});
   const revision=await database.db.selectFrom('_cms_revisions').selectAll().where('id','=',saved.draftRevisionId).executeTakeFirstOrThrow();
   assert.equal(JSON.parse(revision.data)._slug,'new-slug');
  }else{
   assert.equal(saved.draftRevisionId,null);assert.equal(saved.liveData,undefined);
   assert.deepEqual(await database.db.selectFrom('_cms_revisions').selectAll().orderBy('id').execute(),history);
  }
  assert.deepEqual(await ordinary.getContent({type:'post',id:created.id}),saved);
 }finally{await storage.close();}
});
