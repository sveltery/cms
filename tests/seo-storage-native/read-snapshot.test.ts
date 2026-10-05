// Supplemental Source content.ts:281/295 read contract, EmDash1.1.0
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. No Source callback/runner credit.
import assert from 'node:assert/strict';
import {test} from 'vitest';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {ContentRepository} from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import type {ContentItem} from '../../src/lib/server/database/lifecycle/upstream/database/repositories/types.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {hydrateContentSeo,hydrateContentSeoMany} from '../../src/lib/server/seo/content-read.ts';
import {historicalFeatureStorage} from '../helpers/canonical-feature-storage-original.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';

type Single=(database:CmsDatabase,collection:string,item:ContentItem,hasSeo:boolean)=>Promise<ContentItem>;
type Many=(database:CmsDatabase,collection:string,items:ContentItem[],hasSeo:boolean)=>Promise<ContentItem[]>;

for(const kind of ['single','batch'] as const)for(const enabled of [true,false]){
 test('Source '+kind+' hydration uses the trusted '+enabled+' metadata snapshot',async()=>{
  const fixture=await historicalFeatureStorage('Node');
  try{
   await migrateCms(fixture.database);
   const registry=new SchemaRegistry(fixture.database);
   await registry.createCollection({slug:'post',label:'Posts',supports:['seo','drafts']});
   const service=lifecycleService(fixture.database,principal,{after:()=>{}});
   const created=await service.createContent({type:'post',data:{},seo:{title:'Persisted SEO'}});
   if(!enabled)await registry.updateCollection('post',{hasSeo:false});
   const metadata=await registry.getCollectionWithFields('post');
   assert.equal(metadata?.hasSeo,enabled);
   // Ordinary sequential metadata writes distinguish the captured Source
   // argument from a later lookup. No concurrent/auth/HTTP/race probe.
   await registry.updateCollection('post',{hasSeo:!enabled});
   assert.equal((await registry.getCollectionWithFields('post'))?.hasSeo,!enabled);
   const item=await new ContentRepository(fixture.database.db as any).findById('post',created.id);
   assert.ok(item);assert.equal(Object.hasOwn(item,'seo'),false);
   const hydrated=kind==='single'
    ?await (hydrateContentSeo as unknown as Single)(fixture.database,'post',item,metadata!.hasSeo)
    :(await (hydrateContentSeoMany as unknown as Many)(fixture.database,'post',[item],metadata!.hasSeo))[0];
   if(enabled)assert.equal(hydrated.seo?.title,'Persisted SEO');
   else {assert.equal(Object.hasOwn(hydrated,'seo'),false);assert.strictEqual(hydrated,item);}
  }finally{await fixture.close();}
 });
}
