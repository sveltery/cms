import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sql} from 'kysely';
import {historicalFeatureStorage,type StorageMode} from './helpers/canonical-feature-storage-original.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {ordinaryContentService} from '../src/lib/server/database/content-service.ts';
import {RelationRepository} from '../src/lib/server/relations/repository.ts';
import {servicePrincipal} from '../src/lib/server/auth/composition.ts';
import {Role} from '../src/lib/server/auth/roles.ts';

for(const mode of ['Node','raw D1','scoped D1'] as const satisfies readonly StorageMode[]){
 test(`${mode} the existing content owner resolves and commits references with create and update`,async()=>{
  const host=await historicalFeatureStorage(mode,0);
  try{
   await migrateCms(host.database);
   const registry=new SchemaRegistry(host.database);
   for(const slug of ['post','page']){await registry.createCollection({slug,label:slug});await registry.createField(slug,{slug:'title',label:'Title',type:'string'});}
   const relation=await new RelationRepository(host.database).create({slug:'owner_refs',parentCollection:'post',childCollection:'page',parentLabel:'Posts',childLabel:'Pages'});
   await registry.createField('post',{slug:'related',label:'Related',type:'reference',validation:{relation:relation.slug}});
   const owner=ordinaryContentService(host.database,servicePrincipal({id:'ordinary-original-unit-admin',role:Role.ADMIN}));
   const first=await owner.createContent({type:'page',locale:'en',data:{title:'First'}});
   const second=await owner.createContent({type:'page',locale:'en',data:{title:'Second'}});
   let created;
   try{created=await owner.createContent({type:'post',locale:'en',data:{title:'Original'},references:{related:[first.id]}});}catch{}
   assert.ok(created,'existing content create must support a valid original reference selection');
   const repo=new RelationRepository(host.database);
   assert.deepEqual((await repo.getChildren(relation.id,created.translationGroup!)).map(edge=>edge.childGroup),[first.translationGroup]);
   let updated;
   try{updated=await owner.updateContent({type:'post',id:created.id,locale:'en',data:{title:'Changed'},references:{related:[second.id]},expected:{version:created.version,updatedAt:created.updatedAt}});}catch{}
   assert.ok(updated,'existing caller-CAS update must support the same reference input');
   assert.equal(updated.data.title,'Changed');
   assert.deepEqual((await repo.getChildren(relation.id,created.translationGroup!)).map(edge=>edge.childGroup),[second.translationGroup]);
  }finally{await host.close();}
 });
 test(`${mode} a reference SQL abort rolls back the existing content row on create and update`,async()=>{
  const host=await historicalFeatureStorage(mode,0);
  try{
   await migrateCms(host.database);
   const registry=new SchemaRegistry(host.database);
   for(const slug of ['post','page']){await registry.createCollection({slug,label:slug});await registry.createField(slug,{slug:'title',label:'Title',type:'string'});}
   const relation=await new RelationRepository(host.database).create({slug:'owner_abort',parentCollection:'post',childCollection:'page',parentLabel:'Posts',childLabel:'Pages'});
   await registry.createField('post',{slug:'related',label:'Related',type:'reference',validation:{relation:relation.slug}});
   const owner=ordinaryContentService(host.database,servicePrincipal({id:'ordinary-original-unit-admin',role:Role.ADMIN}));
   const target=await owner.createContent({type:'page',locale:'en',data:{title:'Target'}});
   const original=await owner.createContent({type:'post',locale:'en',data:{title:'Original'}});
   await sql`CREATE TRIGGER content_reference_actual_abort BEFORE INSERT ON _cms_content_references BEGIN SELECT RAISE(ABORT,'actual content reference failure'); END`.execute(host.database.db);
   const createError=await owner.createContent({type:'post',locale:'en',data:{title:'Must roll back'},references:{related:[target.id]}}).then(()=>null,error=>error);
   assert.match(String(createError),/actual content reference failure/,'must reach actual edge SQL inside the single content transaction');
   assert.equal(Number((await sql<{count:number}>`SELECT COUNT(*) AS count FROM ec_post`.execute(host.database.db)).rows[0].count),1);
   const updateError=await owner.updateContent({type:'post',id:original.id,locale:'en',data:{title:'Must roll back'},references:{related:[target.id]},expected:{version:original.version,updatedAt:original.updatedAt}}).then(()=>null,error=>error);
   assert.match(String(updateError),/actual content reference failure/);
   const after=await owner.getContent({type:'post',id:original.id,locale:'en'});
   assert.deepEqual([after.data.title,after.version,after.updatedAt],['Original',original.version,original.updatedAt]);
   assert.deepEqual(await new RelationRepository(host.database).getChildren(relation.id,original.translationGroup!),[]);
  }finally{await host.close();}
 });
}
