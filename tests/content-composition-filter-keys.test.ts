// Original review regressions, zero copied Source assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService} from '../src/lib/server/database/service.ts';

for(const target of ['Node','D1'] as const)for(const field of ['constructor','prototype'])test(`${target}: ordinary list and count retain indexed ${field} own-key filters`,async()=>{
 const storage=await schemaAdminStorage(target);
 try{
  await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
  await registry.createCollection({slug:'post',label:'Posts',supports:[]});
  await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  await registry.createField('post',{slug:field,label:field,type:'string',indexed:true});
  const service=cmsService(storage.database,{id:'review-admin',permissions:['content:read','content:read_drafts','content:create']});
  const wanted=await service.createContent({type:'post',data:{title:'Wanted',[field]:'x'}});
  await service.createContent({type:'post',data:{title:'Other',[field]:'y'}});
  const filters=JSON.parse(`{"${field}":"x"}`);
  const page=await service.listContent({type:'post',fieldFilters:filters});
  assert.equal(page.total,1);assert.deepEqual(page.items.map(item=>item.id),[wanted.id]);
  assert.equal(await service.countContent({type:'post',fieldFilters:filters}),1);
 }finally{await storage.close();}
});
