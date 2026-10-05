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
import {runWithContext} from '../src/lib/server/menus/context.ts';
import {requestCached} from '../src/lib/server/menus/request-cache.ts';
import {cachedQuery,contentCacheNamespaces,__setObjectCacheBackendForTests} from '../src/lib/server/menus/object-cache.ts';
import {createDeferredTaskTracker,waitForDeferredTasks} from '../src/lib/server/redirects/deferred-tasks.ts';

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
  await registry.createField('post',{slug:'related',label:'Related',type:'reference',validation:{relation:relation.slug,relationSide:'parent',targetCollection:'page'}});
  await registry.createField('page',{slug:'backlinks',label:'Backlinks',type:'reference',validation:{relation:relation.slug,relationSide:'child',targetCollection:'post'}});
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
   await registry.createField('post',{slug:'featured',label:'Featured',type:'reference',validation:{relation:relation.slug,relationSide:'parent',targetCollection:'page'}});
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

function memoryBackend(){
 const values=new Map<string,string>();
 return {values,async get(key:string){return values.get(key)??null;},async set(key:string,value:string){values.set(key,value);},async delete(key:string){values.delete(key);}};
}
async function cacheHost(run:(value:Awaited<ReturnType<typeof setup>>,tracker:ReturnType<typeof createDeferredTaskTracker>)=>Promise<void>){
 const value=await setup('Node');const backend=memoryBackend();const tracker=createDeferredTaskTracker(()=>{});
 __setObjectCacheBackendForTests(backend,{revalidate:0});
 try{await run(value,tracker);await waitForDeferredTasks();}finally{__setObjectCacheBackendForTests(null);await value.host.close();}
}
test('a committed reference draft refreshes only the selecting collection in the same actual request cache',async()=>cacheHost(async({owner,a,b,published},tracker)=>{
 await runWithContext({editMode:false,deferredTasks:tracker},async()=>{
  let reads=0;const read=()=>requestCached('collection:post:',async()=>{reads++;return (await owner.getContent({type:'post',id:published.id,locale:'en'})).references?.related?.children.map(child=>child.id);});
  const sibling=await requestCached('collection:post2:',async()=>({retained:true}));
  const unrelated=await requestCached('menu:header',async()=>({retained:true}));
  assert.deepEqual(await read(),[a.id]);
  await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:[b.id]},expected:{version:published.version,updatedAt:published.updatedAt}});
  assert.deepEqual(await read(),[b.id]);assert.equal(reads,2);
  assert.equal(await requestCached('collection:post2:',async()=>({retained:false})),sibling);
  assert.equal(await requestCached('menu:header',async()=>({retained:false})),unrelated);
 });
}));
test('a committed reference-only draft refreshes the existing configured L2 collection snapshot',async()=>cacheHost(async({owner,a,b,published},tracker)=>{
 let reads=0;const read=()=>runWithContext({editMode:false,deferredTasks:tracker},()=>cachedQuery({namespace:contentCacheNamespaces('post'),key:'actual-reference-read',load:async()=>{reads++;return(await owner.getContent({type:'post',id:published.id,locale:'en'})).references?.related?.children.map(child=>child.id);}}));
 assert.deepEqual(await read(),[a.id]);await waitForDeferredTasks();assert.deepEqual(await read(),[a.id]);assert.equal(reads,1);
 await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:[b.id]},expected:{version:published.version,updatedAt:published.updatedAt}});
 assert.deepEqual(await read(),[b.id]);assert.equal(reads,2);
}));
test('publication with no staged reference selection refreshes the bound collection snapshot',async()=>cacheHost(async({owner,published},tracker)=>{
 let reads=0;const read=()=>runWithContext({editMode:false,deferredTasks:tracker},()=>cachedQuery({namespace:contentCacheNamespaces('post'),key:'actual-published-read',load:async()=>{reads++;return(await (owner as any).getPublishedContent({type:'post',id:published.id,locale:'en'})).data.title;}}));
 assert.equal(await read(),'Original');await waitForDeferredTasks();assert.equal(await read(),'Original');
 const saved=await owner.updateContent({type:'post',id:published.id,locale:'en',data:{title:'Retitled'},expected:{version:published.version,updatedAt:published.updatedAt}});
 assert.equal(await read(),'Original');assert.equal(reads,1);
 await owner.publish({type:'post',id:published.id,locale:'en',expected:{version:saved.item.version,updatedAt:saved.item.updatedAt}});
 assert.equal(await read(),'Retitled');assert.equal(reads,2);
}));
test('an actual staged-reference SQL abort retains warm L1/L2 snapshots and the stored selection',async()=>cacheHost(async({host,owner,a,b,published},tracker)=>{
 await runWithContext({editMode:false,deferredTasks:tracker},async()=>{
  let reads=0;const read=()=>requestCached('collection:post:',()=>cachedQuery({namespace:contentCacheNamespaces('post'),key:'rollback-reference-read',load:async()=>{reads++;return(await owner.getContent({type:'post',id:published.id,locale:'en'})).references?.related?.children.map(child=>child.id);}}));
  assert.deepEqual(await read(),[a.id]);await waitForDeferredTasks();
  await sql`CREATE TRIGGER read_stage_actual_abort BEFORE INSERT ON _cms_revisions BEGIN SELECT RAISE(ABORT,'actual read stage failure'); END`.execute(host.database.db);
  const failure=await owner.updateContent({type:'post',id:published.id,locale:'en',references:{related:[b.id]},expected:{version:published.version,updatedAt:published.updatedAt}}).then(()=>null,error=>error);
  assert.match(String(failure),/actual read stage failure/);
  assert.deepEqual(await read(),[a.id]);assert.equal(reads,1);
  assert.deepEqual((await owner.getContent({type:'post',id:published.id,locale:'en'})).references?.related?.children.map(child=>child.id),[a.id]);
 });
}));
