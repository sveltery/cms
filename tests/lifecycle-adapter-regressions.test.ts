import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {ContentRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {RevisionRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {principal} from './helpers/lifecycle-fixture.ts';
import {CmsError} from '../src/lib/server/database/contract.ts';
import {ContentDatetimeNormalizer} from '../src/lib/server/database/lifecycle/upstream/database/content-datetime.ts';

// Original adapter regressions, not copied source declarations. Mixed-save
// behavior follows pinned Runtime:3887; native restore CAS extends source API.
const expected=(item:{version:number;updatedAt:string})=>({version:item.version,updatedAt:item.updatedAt});
for(const target of ['Node','D1'] as const) {
  test(`${target}: live metadata saves keep staged data and slug unpublished`,async()=>{
    const storage=await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
      await registry.createCollection({slug:'post',label:'Posts'});
      await registry.createField('post',{slug:'title',label:'Title',type:'string'});
      const service=lifecycleService(storage.database,principal,{after:()=>{}});
      const initial=await service.createContent({type:'post',slug:'live-slug',data:{title:'Live'}});
      const key={type:'post',id:initial.id};const published=await service.publish(key);
      const staged=await service.updateContent({...key,expected:expected(published),data:{title:'Draft'},slug:'draft-slug',publishedAt:'2020-01-01T00:00:00.000Z'});
      assert.equal(staged.liveContentChanged,true);
      const live=await service.readPublished(key);
      assert.equal(live?.data.title,'Live');assert.equal(live?.slug,'live-slug');
      assert.equal(live?.publishedAt,'2020-01-01T00:00:00.000Z');
      const revision=await new RevisionRepository(storage.database.db as any).findById(staged.item.draftRevisionId!);
      assert.equal(revision?.data._slug,'draft-slug');assert.equal(revision?.data.title,'Draft');
      const promoted=await service.publish({...key,expected:expected(staged.item)});
      assert.equal(promoted.slug,'draft-slug');assert.equal(promoted.data.title,'Draft');
    } finally {await storage.close();}
  });
  for(const supportsRevisions of [true,false])for(const phase of ['before-refetch','after-refetch']) {
    test(`${target}: ${supportsRevisions?'revision':'plain'} restore cannot replace a save ${phase}`,async()=>{
      const storage=await schemaAdminStorage(target);
      const prototype=ContentRepository.prototype as any;
      const method=supportsRevisions?'restoreDraftRevision':'restoreRevision';
      const original=prototype[method];
      const normalize=ContentDatetimeNormalizer.prototype.normalizeData;
      try {
        await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
        await registry.createCollection({slug:'post',label:'Posts',...(supportsRevisions?{}:{supports:[]})});
        await registry.createField('post',{slug:'title',label:'Title',type:'string'});
        const service=lifecycleService(storage.database,principal,{after:()=>{}});
        const initial=await service.createContent({type:'post',slug:'restore',data:{title:'Current'}});
        const key={type:'post',id:initial.id};const token=expected(initial);
        const repository=new RevisionRepository(storage.database.db as any);
        const historical=await repository.create({collection:'post',entryId:initial.id,data:{title:'Historical'},authorId:principal.id});
        let intervening:any;let inRestore=false;let injected=false;
        const intervene=async()=>{intervening=(await service.updateContent({...key,data:{title:'Intervening'}})).item;};
        prototype[method]=async function(...args:any[]) {
          if(phase==='before-refetch')await intervene();
          inRestore=true;
          return original.apply(this,args);
        };
        if(phase==='after-refetch')ContentDatetimeNormalizer.prototype.normalizeData=async function(type:string,data:Record<string,unknown>) {
          if(inRestore&&!injected&&data.title==='Historical'){injected=true;await intervene();}
          return normalize.call(this,type,data);
        };
        await assert.rejects(()=>service.restoreRevision({...key,revisionId:historical.id,expected:token}),
          (cause:unknown)=>cause instanceof CmsError&&cause.code==='CONFLICT');
        const after=await service.getContent(key);
        assert.equal(after.version,intervening.version);assert.equal(after.data.title,'Intervening');
        const revisions=await service.listRevisions(key);
        assert.equal(revisions.length,supportsRevisions?2:1,'losing restore adds no audit row');
      } finally {prototype[method]=original;ContentDatetimeNormalizer.prototype.normalizeData=normalize;await storage.close();}
    });
  }
}
