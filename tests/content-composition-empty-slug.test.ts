// Original domain controls for a native form substitution. No Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService, type ServerPrincipal} from '../src/lib/server/database/service.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';

const actor:ServerPrincipal={id:'blank-slug-admin',permissions:['content:read','content:read_drafts','content:create','content:edit_any','content:publish_any']};
for(const target of ['Node','D1'] as const)for(const explicitData of [false,true])for(const slug of [null,''])test(`${target}: domain ${slug===null?'null':'empty string'} slug remains distinct with ${explicitData?'explicit empty':'omitted'} data`,async()=>{
 const storage=await schemaAdminStorage(target);
 try{
  const database=storage.database;await migrateCms(database);const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'post',label:'Posts',routable:false,urlPattern:null});await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const ordinary=cmsService(database,actor,{after:()=>{}}),lifecycle=lifecycleService(database,actor,{after:()=>{}});
  const created=await ordinary.createContent({type:'post',slug:'original-live',data:{title:'Published title'}});
  const published=await lifecycle.publish({type:'post',id:created.id});
  const history=(await sql`SELECT * FROM _cms_revisions ORDER BY id`.execute(database.db)).rows;
  const saved=await ordinary.updateContent({type:'post',id:created.id,slug,expected:{version:published.version,updatedAt:published.updatedAt},...(explicitData?{data:{}}:{})});
  assert.equal(saved.liveRevisionId,published.liveRevisionId);assert.equal(saved.version,published.version+1);
  assert.deepEqual(saved.data,{title:'Published title'});
  if(explicitData){
   assert.equal(saved.slug,'original-live');assert.ok(saved.draftRevisionId);
   const revision=(await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE id=${saved.draftRevisionId}`.execute(database.db)).rows[0];
   assert.equal(JSON.parse(revision.data)._slug,slug);
   assert.deepEqual(saved.liveData,{title:'Published title'});
  }else{
   assert.equal(saved.slug,slug);assert.equal(saved.draftRevisionId,null);assert.equal(saved.liveData,undefined);
   assert.deepEqual((await sql`SELECT * FROM _cms_revisions ORDER BY id`.execute(database.db)).rows,history);
  }
 }finally{await storage.close();}
});
