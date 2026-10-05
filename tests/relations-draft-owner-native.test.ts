import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sql} from 'kysely';
import {historicalFeatureStorage,type StorageMode} from './helpers/canonical-feature-storage-original.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {RelationRepository} from '../src/lib/server/relations/repository.ts';
import {RevisionRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {servicePrincipal} from '../src/lib/server/auth/composition.ts';
import {Role} from '../src/lib/server/auth/roles.ts';

async function setup(mode:StorageMode){
 const host=await historicalFeatureStorage(mode,0);
 try{
  await migrateCms(host.database);const registry=new SchemaRegistry(host.database);
  for(const slug of ['post','page']){await registry.createCollection({slug,label:slug});await registry.createField(slug,{slug:'title',label:'Title',type:'string'});}
  const relation=await new RelationRepository(host.database).create({slug:'draft_owner_refs',parentCollection:'post',childCollection:'page',parentLabel:'Posts',childLabel:'Pages'});
  await registry.createField('post',{slug:'related',label:'Related',type:'reference',validation:{relation:relation.slug}});
  const owner=lifecycleService(host.database,servicePrincipal({id:'ordinary-original-unit-admin',role:Role.ADMIN}),{after(){}});
  const a=await owner.createContent({type:'page',locale:'en',data:{title:'A'}});
  const b=await owner.createContent({type:'page',locale:'en',data:{title:'B'}});
  const post=await owner.createContent({type:'post',locale:'en',data:{title:'Original'},references:{related:[a.id]}});
  const published=await owner.publish({type:'post',id:post.id,locale:'en'});
  const repository=new RelationRepository(host.database);const revisions=new RevisionRepository(host.database.db as any);
  return{host,owner,a,b,published,repository,revisions,relation};
 }catch(cause){await host.close();throw cause;}
}
for(const mode of ['Node','raw D1','scoped D1'] as const satisfies readonly StorageMode[]){
 test(`${mode} reference-only saves stage against the original live baseline and publish into real revision history`,async()=>{
  const {host,owner,a,b,published,repository,revisions,relation}=await setup(mode);
  try{
   let saved;try{saved=await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:[b.id]},expected:{version:published.version,updatedAt:published.updatedAt}});}catch{}
   assert.ok(saved,'reference-only saves must stage through the existing revision writer');
   assert.equal(saved.liveContentChanged,false);
   assert.deepEqual((await repository.getChildren(relation.id,published.translationGroup!)).map(edge=>edge.childGroup),[a.translationGroup]);
   const draft=await revisions.findById(saved.item.draftRevisionId!);
   assert.deepEqual(draft?.data._references,{related:[b.translationGroup]});
   assert.deepEqual(draft?.data._referencesBaseline,{related:[a.translationGroup]});
   const savedAgain=await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:[a.id,b.id]},expected:{version:saved.item.version,updatedAt:saved.item.updatedAt}});
   const nextDraft=await revisions.findById(savedAgain.item.draftRevisionId!);
   assert.deepEqual(nextDraft?.data._referencesBaseline,{related:[a.translationGroup]});
   const promoted=await owner.publish({type:'post',id:published.id,locale:'en',expected:{version:savedAgain.item.version,updatedAt:savedAgain.item.updatedAt}});
   assert.equal(promoted.draftRevisionId,null);
   assert.deepEqual((await repository.getChildren(relation.id,published.translationGroup!)).map(edge=>edge.childGroup),[a.translationGroup,b.translationGroup]);
   assert.deepEqual((await revisions.findById(promoted.liveRevisionId!))?.data._references,{related:[a.translationGroup,b.translationGroup]});
   assert.deepEqual((await revisions.findById(published.liveRevisionId!))?.data._references,{related:[a.translationGroup]},'earlier published history remains intact');
  }finally{await host.close();}
 });
 test(`${mode} an actual edge SQL failure preserves the staged pointer, prior live edges and all history`,async()=>{
  const {host,owner,a,b,published,repository,revisions,relation}=await setup(mode);
  try{
   let saved;try{saved=await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:[b.id]},expected:{version:published.version,updatedAt:published.updatedAt}});}catch{}
   assert.ok(saved,'actual publication rollback needs a real staged revision');
   const before=await revisions.findByEntry('post',published.id);
   await sql`CREATE TRIGGER draft_reference_actual_abort BEFORE INSERT ON _cms_content_references WHEN NEW.child_group=${sql.lit(b.translationGroup!)} BEGIN SELECT RAISE(ABORT,'actual draft reference failure'); END`.execute(host.database.db);
   const error=await owner.publish({type:'post',id:published.id,locale:'en',expected:{version:saved.item.version,updatedAt:saved.item.updatedAt}}).then(()=>null,error=>error);
   assert.match(String(error),/actual draft reference failure/);
   const after=await owner.getContent({type:'post',id:published.id,locale:'en'});
   assert.deepEqual([after.version,after.updatedAt,after.liveRevisionId,after.draftRevisionId],[saved.item.version,saved.item.updatedAt,published.liveRevisionId,saved.item.draftRevisionId]);
   assert.deepEqual((await repository.getChildren(relation.id,published.translationGroup!)).map(edge=>edge.childGroup),[a.translationGroup]);
   assert.deepEqual(await revisions.findByEntry('post',published.id),before);
  }finally{await host.close();}
 });
}
