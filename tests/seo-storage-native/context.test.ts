import assert from 'node:assert/strict';
import {test} from 'vitest';
import {sql} from 'kysely';
import {runWithContext,getRequestContext} from '../../src/lib/server/seo/context.ts';
import * as seoCache from '../../src/lib/server/seo/request-cache.ts';
import {runWithContext as sharedRun,getRequestContext as sharedContext} from '../../src/lib/server/menus/context.ts';
import * as sharedCache from '../../src/lib/server/menus/request-cache.ts';
import {createDeferredTaskTracker,waitForDeferredTasks} from '../../src/lib/server/redirects/deferred-tasks.ts';
import {cachedQuery,__setObjectCacheBackendForTests,contentNamespace} from '../../src/lib/server/menus/object-cache.ts';
import {createObjectCache} from '../../src/lib/server/menus/object-cache-memory.ts';
import {historicalFeatureStorage} from '../helpers/canonical-feature-storage-original.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';

test('legacy SEO context preserves the exact caller object in the shared owner',async()=>{
 const context={db:{legacy:'read host'},metrics:{cacheHits:0,cacheMisses:0}};
 const keys=Object.keys(context);
 await runWithContext(context,async()=>{
  await Promise.resolve();
  assert.strictEqual(getRequestContext(),context);
  assert.strictEqual(sharedContext(),context);
  assert.deepEqual(Object.keys(context),keys);
 });
 assert.equal(getRequestContext(),undefined);
});

test('both public cache APIs share promises, prime semantics and explicit invalidation',async()=>{
 await runWithContext({},async()=>{
  let calls=0;
  const first=seoCache.requestCached('seo-native-handoff',async()=>++calls);
  const second=sharedCache.requestCached('seo-native-handoff',async()=>++calls);
  assert.strictEqual(first,second);
  assert.equal(await second,1);
  sharedCache.clearRequestCacheEntry('seo-native-handoff');
  assert.equal(await seoCache.requestCached('seo-native-handoff',async()=>++calls),2);
  seoCache.setRequestCacheEntry('seo-native-prime',3);
  sharedCache.setRequestCacheEntry('seo-native-prime',4);
  assert.equal(await sharedCache.peekRequestCache('seo-native-prime'),3);
 });
});

test('nested actual request objects isolate their cache and restore the outer owner',async()=>{
 const outer={editMode:false},inner={editMode:false};
 await sharedRun(outer,async()=>{
  seoCache.setRequestCacheEntry('seo-native-isolation','outer');
  await runWithContext(inner,async()=>{
   assert.equal(seoCache.peekRequestCache('seo-native-isolation'),undefined);
   sharedCache.setRequestCacheEntry('seo-native-isolation','inner');
   assert.equal(await seoCache.peekRequestCache('seo-native-isolation'),'inner');
  });
  assert.strictEqual(getRequestContext(),outer);
  assert.equal(await sharedCache.peekRequestCache('seo-native-isolation'),'outer');
 });
});

test('actual committed SEO invalidates the existing cache and one request tracker drains its work',async()=>{
 const fixture=await historicalFeatureStorage('Node');
 const backend=createObjectCache({});
 __setObjectCacheBackendForTests(backend,{keyPrefix:'seo109-canonical-control'});
 try{
  await migrateCms(fixture.database);
  await new SchemaRegistry(fixture.database).createCollection({slug:'post',label:'Posts',supports:['seo','drafts']});
  const service=lifecycleService(fixture.database,principal,{after:()=>{}});
  const created=await service.createContent({type:'post',data:{},seo:{title:'Before'}});
  await waitForDeferredTasks();
  let loads=0;
  const load=()=>cachedQuery({namespace:contentNamespace('post'),key:'seo109-native-entry',load:async()=>{
   loads++;
   return (await service.getContent({type:'post',id:created.id})).seo!.title;
  }});
  assert.equal(await sharedRun({editMode:false},load),'Before');
  assert.equal(await runWithContext({editMode:false},load),'Before');
  assert.equal(loads,1);
  let settled=0;
  const deferredTasks=createDeferredTaskTracker(()=>settled++);
  const kept:Promise<void>[]=[];
  await sharedRun({editMode:false,deferredTasks,keepAlive:task=>kept.push(task)},async()=>{
   assert.strictEqual(getRequestContext(),sharedContext());
   await service.updateContent({type:'post',id:created.id,seo:{title:'After'}});
   deferredTasks.settle();
   await deferredTasks.settled;
  });
  assert.equal(settled,1);
  assert.ok(kept.length>0);
  assert.equal(await runWithContext({editMode:false},load),'After');
  assert.equal(loads,2);
  await waitForDeferredTasks();
  const failed={...fixture.database,async atomicBatch(statements:any){
   return fixture.database.atomicBatch([...statements,sql`SELECT json_extract('[]','seo-cache-rollback')`.compile(fixture.database.db)]);
  }};
  await assert.rejects(()=>lifecycleService(failed,principal,{after:()=>{}}).updateContent({type:'post',id:created.id,seo:{title:'Rolled back'}}));
  assert.equal(await sharedRun({editMode:false},load),'After');
  assert.equal(loads,2);
 }finally{
  await waitForDeferredTasks();
  __setObjectCacheBackendForTests(null);
  await fixture.close();
 }
});
