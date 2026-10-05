import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sql} from 'kysely';
import {historicalFeatureStorage,type StorageMode} from './helpers/canonical-feature-storage-original.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {ordinaryContentService} from '../src/lib/server/database/content-service.ts';
import {RelationRepository} from '../src/lib/server/relations/repository.ts';
import {RevisionRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {servicePrincipal} from '../src/lib/server/auth/composition.ts';
import {Role} from '../src/lib/server/auth/roles.ts';

// Supplemental actual-owner controls derived from the complete pinned
// reference-draft-lifecycle and reference-constraints families. These are not
// replacements for those whole original callbacks or Source execution credit.
async function setup(mode:StorageMode){
 const host=await historicalFeatureStorage(mode,0);
 try{
  await migrateCms(host.database);const registry=new SchemaRegistry(host.database);
  for(const slug of ['post','page']){await registry.createCollection({slug,label:slug});await registry.createField(slug,{slug:'title',label:'Title',type:'string'});}
  const relations=new RelationRepository(host.database);
  const relation=await relations.create({slug:'read_owner_refs',parentCollection:'post',childCollection:'page',parentLabel:'Posts',childLabel:'Pages'});
  await registry.createField('post',{slug:'related',label:'Related',type:'reference',validation:{relation:relation.slug}});
  await registry.createField('page',{slug:'backlinks',label:'Backlinks',type:'reference',validation:{relation:relation.slug,relationSide:'child'}});
  const principal=servicePrincipal({id:'ordinary-original-unit-admin',role:Role.ADMIN});
  const owner=lifecycleService(host.database,principal,{after(){}});
  const ordinary=ordinaryContentService(host.database,principal,{after(){}});
  const a=await owner.createContent({type:'page',locale:'en',data:{title:'A'}});
  const b=await owner.createContent({type:'page',locale:'en',data:{title:'B'}});
  await owner.publish({type:'page',id:a.id,locale:'en'});
  const post=await owner.createContent({type:'post',locale:'en',data:{title:'Original'},references:{related:[a.id]}});
  const published=await owner.publish({type:'post',id:post.id,locale:'en'});
  return{host,registry,relations,relation,owner,ordinary,a,b,published};
 }catch(cause){await host.close();throw cause;}
}
for(const mode of ['Node','raw D1','scoped D1'] as const satisfies readonly StorageMode[]){
 test(`${mode} actual lifecycle and ordinary reads hydrate staged selections while public reads retain published links`,async()=>{
  const {host,owner,ordinary,a,b,published}=await setup(mode);
  try{
   await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:[b.id]},expected:{version:published.version,updatedAt:published.updatedAt}});
   const item=await owner.getContent({type:'post',id:published.id,locale:'en'});
   assert.deepEqual(item.references?.related?.children.map(child=>child.id),[b.id]);
   assert.deepEqual((await ordinary.getContent({type:'post',id:published.id,locale:'en'})).references?.related?.children.map(child=>child.id),[b.id]);
   const read=(owner as any).getPublishedContent;
   const live=await read?.({type:'post',id:published.id,locale:'en'});
   assert.deepEqual(live?.references?.related?.children.map((child:any)=>child.id),[a.id]);
   assert.equal(live?.data.title,'Original');
  }finally{await host.close();}
 });
 test(`${mode} comparison uses real live edges and merges a staged subset without rewriting history`,async()=>{
  const {host,registry,relation,owner,a,b,published}=await setup(mode);
  try{
   await registry.createField('post',{slug:'featured',label:'Featured',type:'reference',validation:{relation:relation.slug}});
   const updated=await owner.updateContent({type:'post',id:published.id,locale:'en',data:{title:'Retitled'},references:{related:[b.id]},expected:{version:published.version,updatedAt:published.updatedAt}});
   const revisions=new RevisionRepository(host.database.db as any);
   const before=await revisions.findByEntry('post',published.id);
   const compare=(owner as any).compareContent;
   const result=await compare?.({type:'post',id:published.id,locale:'en'});
   assert.equal(result?.hasChanges,true);
   assert.deepEqual(result.live?._references,{related:[a.translationGroup],featured:[a.translationGroup]});
   assert.deepEqual(result.draft?._references,{related:[b.translationGroup],featured:[a.translationGroup]});
   assert.equal(result.draft?.title,'Retitled');
   assert.deepEqual(await revisions.findByEntry('post',published.id),before);
   assert.equal((await owner.getContent({type:'post',id:published.id,locale:'en'})).draftRevisionId,updated.item.draftRevisionId);
  }finally{await host.close();}
 });
 test(`${mode} inverse hydration returns locale fallback and filters real soft-deleted targets`,async()=>{
  const {host,owner,ordinary,a,published}=await setup(mode);
  try{
   await sql`UPDATE ec_page SET locale='fr' WHERE id=${a.id}`.execute(host.database.db);
   const parent=await owner.getContent({type:'post',id:published.id,locale:'en'});
   assert.deepEqual(parent.references?.related?.children.map(child=>[child.id,child.locale,child.title]),[[a.id,'fr','A']]);
   const child=await ordinary.getContent({type:'page',id:a.id,locale:'fr'});
   assert.deepEqual(child.references?.backlinks?.children.map(reference=>reference.id),[published.id]);
   await sql`UPDATE ec_page SET deleted_at='2026-01-01T00:00:00.000Z' WHERE id=${a.id}`.execute(host.database.db);
   assert.deepEqual((await owner.getContent({type:'post',id:published.id,locale:'en'})).references?.related?.children,[]);
  }finally{await host.close();}
 });
}
test('Node hydration pages the actual 51-entry draft selection and retains its next cursor',async()=>{
 const {host,owner,published}=await setup('Node');
 try{
  const targets=[];for(let index=0;index<51;index++)targets.push(await owner.createContent({type:'page',locale:'en',data:{title:`Target ${index}`}}));
  await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:targets.map(target=>target.id)},expected:{version:published.version,updatedAt:published.updatedAt}});
  const selection=(await owner.getContent({type:'post',id:published.id,locale:'en'})).references?.related;
  assert.deepEqual(selection?.children.map(child=>child.id),targets.slice(0,50).map(target=>target.id));
  assert.ok(selection?.nextCursor);
 }finally{await host.close();}
});
