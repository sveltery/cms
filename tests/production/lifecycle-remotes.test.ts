import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';
import { lifecycleMigration } from '../../src/lib/server/database/lifecycle-migrations.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { withRevision } from '../../src/lib/server/content/schema.ts';
import { contentEntry } from '../../src/lib/server/lifecycle/schema.ts';
import { sql } from 'kysely';
import { RevisionRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';

// Supplemental native HTTP evidence. Source lifecycle assertions are preserved
// separately in lifecycle-upstream.test.ts and the immutable source ledger.
const mutations=['publishContent','unpublishContent','discardContentDraft','restoreContentRevision'];
const actor={id:'user_author',permissions:['content:read','content:read_drafts','content:create','content:edit_own','content:publish_own']} as any;
const denied=(value:any,status:number,code:string)=>{
  assert.equal(value.type,'error');assert.equal(value.status,status);assert.equal(value.error.code,code);
};

test('registered lifecycle remotes enforce qualified tokens, permissions, origin and persisted revision transitions',async(t)=>{
  const fixture=await persistedRemotes({persistedSessions:true,mutationsEnabled:true});
  try {
    // Central version-5 integration is owned separately. This explicit provider
    // fixture proves native transport only; it is not startup-migration credit.
    const installed=(await sql`SELECT name FROM sqlite_master WHERE name='_cms_revisions'`.execute(fixture.database.db)).rows.length;
    if(!installed)await fixture.database.atomicBatch(await lifecycleMigration.statements(fixture.database));
    for(const name of [...mutations,'listContentRevisions','getLifecycleContent'])assert.ok(fixture.ids.has(name),`registered ${name}`);
    const service=lifecycleService(fixture.database,actor,{after:()=>{}});
    const initial=await service.createContent({type:'post',data:{title:'Live first'},slug:'lifecycle-native'});
    const archived=await new RevisionRepository(fixture.database.db as any).create({collection:'post',entryId:initial.id,data:{title:'Archived'},authorId:'user_author'});
    const key={collection:'post',id:initial.id,locale:'en'};
    const token=(item:any)=>withRevision(contentEntry(item))._rev;
    const input=(item:any)=>({...key,_rev:token(item)});
    await t.test('invalid schemas, identity claims, anonymous requests and forbidden origins fail closed',async()=>{
      for(const name of mutations){
        const value={...input(initial),...(name==='restoreContentRevision'?{revisionId:archived.id}:{})};
        denied(await fixture.remote(name,null,value),401,'UNAUTHENTICATED');
        denied(await fixture.remote(name,'contributor',value),403,'INSUFFICIENT_PERMISSIONS');
        const forged=await fixture.remote(name,'author',{...value,principal:'admin'});
        assert.equal(forged.type,'result');assert.ok(parse(forged.data)._.issues.length);
        const response=await fixture.request(`/_app/remote/${fixture.ids.get(name)}`,'author',{
          method:'POST',headers:{origin:'https://foreign.test'},body:new URLSearchParams(value)
        });
        assert.equal(response.status,403);
      }
      denied(await fixture.remote('listContentRevisions',null,undefined,key),401,'UNAUTHENTICATED');
      denied(await fixture.remote('listContentRevisions','subscriber',undefined,key),403,'INSUFFICIENT_PERMISSIONS');
      const invalid=await fixture.remote('publishContent','author',{...input(initial),_rev:''});
      assert.ok(parse(invalid.data)._.issues.length);
      assert.equal((await service.getContent({type:'post',id:initial.id})).version,initial.version);
    });
    let published:any;
    await t.test('publish returns a bounded fresh receipt and preserves live data during staging',async()=>{
      const result=await fixture.mutate('publishContent',input(initial));
      const receipt=result._.result;
      assert.deepEqual(Object.keys(receipt).sort(),['_rev','id','locale','type']);
      assert.equal(receipt.id,initial.id);assert.notEqual(receipt._rev,token(initial));
      published=await service.getContent({type:'post',id:initial.id});
      assert.equal(published.status,'published');assert.equal(published.data.title,'Live first');
      const staged=await service.updateContent({type:'post',id:initial.id,data:{title:'Draft second'},skipRevision:true});
      assert.equal(staged.item.liveData?.title,'Live first');assert.equal(staged.item.updatedAt,published.updatedAt);
      published=staged.item;
      const history=await fixture.query('listContentRevisions',key);
      assert.ok(history.some((row:any)=>row.id===published.liveRevisionId));
      assert.ok(history.some((row:any)=>row.id===published.draftRevisionId));
    });
    await t.test('stale and context-swapped publication tokens cannot change the row',async()=>{
      denied(await fixture.remote('publishContent','author',input(initial)),409,'CONFLICT');
      for(const changed of [{id:'different-entry'},{locale:'fr'},{collection:'page'}]) {
        denied(await fixture.remote('publishContent','author',{...input(published),...changed}),400,'VALIDATION_ERROR');
      }
      denied(await fixture.remote('publishContent','other',input(published)),403,'INSUFFICIENT_PERMISSIONS');
      const after=await service.getContent({type:'post',id:initial.id});
      assert.equal(after.version,published.version);assert.equal(after.draftRevisionId,published.draftRevisionId);
    });
    await t.test('discard, restore and unpublish consume fresh receipts and survive restart',async()=>{
      const discarded=await fixture.mutate('discardContentDraft',input(published));
      let item=await service.getContent({type:'post',id:initial.id});
      assert.equal(item.draftRevisionId,null);assert.equal(item.data.title,'Live first');
      assert.equal(discarded._.result._rev,token(item));
      const restored=await fixture.mutate('restoreContentRevision',{...input(item),revisionId:item.liveRevisionId!});
      item=await service.getContent({type:'post',id:initial.id});
      assert.ok(item.draftRevisionId);assert.equal(item.updatedAt,published.updatedAt);
      assert.equal(restored._.result._rev,token(item));
      const secondPublish=await fixture.mutate('publishContent',input(item));
      item=await service.getContent({type:'post',id:initial.id});
      assert.equal(secondPublish._.result._rev,token(item));assert.equal(item.draftRevisionId,null);
      const unpublished=await fixture.mutate('unpublishContent',input(item));
      item=await service.getContent({type:'post',id:initial.id});
      assert.equal(item.status,'draft');assert.equal(unpublished._.result._rev,token(item));
      const before=await fixture.query('listContentRevisions',key);
      await fixture.restart();
      const after=await fixture.query('listContentRevisions',key);
      assert.deepEqual(after,before);
    });
  } finally {await fixture.close();}
});

test('lifecycle remotes preserve the default-disabled trusted mutation gate',async()=>{
  const fixture=await persistedRemotes({persistedSessions:true});
  try {
    for(const name of mutations)denied(await fixture.remote(name,'author',{
      collection:'post',id:'entry',_rev:'opaque',...(name==='restoreContentRevision'?{revisionId:'revision'}:{})
    }),503,'MUTATIONS_DISABLED');
  } finally {await fixture.close();}
});
