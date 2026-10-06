import assert from 'node:assert/strict';
import {test} from 'node:test';
import {historicalFeatureStorage,type StorageMode} from './helpers/canonical-feature-storage-original.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {ordinaryContentService} from '../src/lib/server/database/content-service.ts';
import {servicePrincipal} from '../src/lib/server/auth/composition.ts';
import {Role} from '../src/lib/server/auth/roles.ts';

// Supplemental actual-owner control for REL3-COMPARE-LOCALE01. The canonical
// content table permits a shared slug across locales. No original Source
// callback, fixture, assertion or clock is replaced by this Native regression.
for(const mode of ['Node','raw D1','scoped D1'] as const satisfies readonly StorageMode[]){
 test(`${mode} comparison retains each locale's live and draft revisions for a shared persisted slug`,async()=>{
  const host=await historicalFeatureStorage(mode,0);
  try{
   await migrateCms(host.database);
   const registry=new SchemaRegistry(host.database);
   await registry.createCollection({slug:'post',label:'Posts'});
   await registry.createField('post',{slug:'title',label:'Title',type:'string'});
   const principal=servicePrincipal({id:'ordinary-original-unit-admin',role:Role.ADMIN});
   const owner=lifecycleService(host.database,principal,{after(){}});
   const ordinary=ordinaryContentService(host.database,principal,{after(){}});
   const entries=[];
   for(const locale of ['en','fr']){
    const created=await owner.createContent({type:'post',locale,slug:'shared-story',data:{title:`${locale} live`}});
    const live=await owner.publish({type:'post',id:created.id,locale});
    const staged=await owner.updateContent({type:'post',id:live.id,locale,data:{title:`${locale} draft`},expected:{version:live.version,updatedAt:live.updatedAt}});
    entries.push(staged.item);
   }
   assert.notEqual(entries[0].id,entries[1].id);
   assert.deepEqual(entries.map(item=>[item.slug,item.locale]),[['shared-story','en'],['shared-story','fr']]);
   for(const item of entries){
    const comparison=await owner.compareContent({type:'post',id:'shared-story',locale:item.locale});
    assert.deepEqual({hasChanges:comparison.hasChanges,live:comparison.live?.title,draft:comparison.draft?.title},
     {hasChanges:true,live:`${item.locale} live`,draft:`${item.locale} draft`});
    const ordinaryComparison=await ordinary.compareContent({type:'post',id:'shared-story',locale:item.locale});
    assert.deepEqual(ordinaryComparison,comparison);
    const idComparison=await owner.compareContent({type:'post',id:item.id,locale:item.locale});
    assert.deepEqual(idComparison,comparison);
   }
  }finally{await host.close();}
 });
}
