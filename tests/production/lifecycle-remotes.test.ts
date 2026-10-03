import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { withRevision } from '../../src/lib/server/content/schema.ts';
import { contentEntry } from '../../src/lib/server/lifecycle/schema.ts';
import { RevisionRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {sql} from 'kysely';

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
    for(const name of [...mutations,'createLifecycleContent','listContentRevisions','getLifecycleContent'])assert.ok(fixture.ids.has(name),`registered ${name}`);
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
    await t.test('unenhanced workflow forms retain locale, issues and the trusted display gate',async()=>{
      const currentService=lifecycleService(fixture.database,actor,{after:()=>{}});
      const french=await currentService.createContent({type:'post',locale:'fr',data:{title:'French workflow'},slug:'native-fr'});
      const path=`/content/post/${french.id}/workflow?locale=fr`;
      const read=async(session='author')=>{
        const response=await fixture.request(path,session);assert.equal(response.status,200);return response.text();
      };
      const forms=(html:string)=>[...html.matchAll(/<form\b[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)].map(match=>({
        action:match[1].replaceAll('&amp;','&'),html:match[2],
        fields:Object.fromEntries([...match[2].matchAll(/<input\b[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/g)].map(value=>[value[1],value[2]]))
      }));
      const publish=forms(await read()).find(form=>form.html.includes('Publish now'))!;
      assert.equal(publish.fields.locale,'fr');assert.equal(publish.fields._rev,token(french));
      assert.doesNotMatch(publish.html,/<button[^>]*disabled/);
      const contributor=forms(await read('contributor')).find(form=>form.html.includes('Publish now'))!;
      assert.match(contributor.html,/<button[^>]*disabled/);
      assert.match(await read('subscriber'),/Content is unavailable/);
      const submit=async(fields:Record<string,string>)=>{
        const action=new URL(publish.action,`http://cms.test${path}`);
        return fixture.request(`${action.pathname}${action.search}`,'author',{
          method:'POST',headers:{origin:'http://cms.test',accept:'text/html'},body:new URLSearchParams(fields)
        });
      };
      const invalid=await submit({...publish.fields,_rev:''});assert.equal(invalid.status,200);
      assert.match(await invalid.text(),/role="alert"/);
      const success=await submit(publish.fields);assert.equal(success.status,200);
      assert.match(await success.text(),/Status: published/);
      assert.equal((await currentService.getContent({type:'post',id:french.id,locale:'fr'})).status,'published');
      assert.equal((await submit(publish.fields)).status,409);
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

test('actual lifecycle HTTP unpublish forwards the trusted request lifetime to real queued pruning',async()=>{
  const anchored:Promise<void>[]=[];
  const fixture=await persistedRemotes({persistedSessions:true,mutationsEnabled:true,keepAlive:task=>anchored.push(task)});
  try {
    const service=lifecycleService(fixture.database,actor,{after:()=>{}});
    const initial=await service.createContent({type:'post',data:{title:'Worker lifetime'},slug:'worker-lifetime'});
    const published=await service.publish({type:'post',id:initial.id});
    const revisions=new RevisionRepository(fixture.database.db as any);
    for(let index=0;index<51;index++)await revisions.create({collection:'post',entryId:initial.id,data:{title:`Old ${index}`}});
    const before=anchored.length;
    const result=await fixture.mutate('unpublishContent',{collection:'post',id:initial.id,locale:'en',_rev:withRevision(contentEntry(published))._rev});
    assert.equal(result._.result.id,initial.id);
    assert.equal(anchored.length-before,2,'session resolution and actual revision cleanup both extend this request');
    await Promise.all(anchored.splice(0));
    const count=(await sql<{n:number}>`SELECT COUNT(*) AS n FROM _cms_revisions WHERE entry_id=${initial.id}`.execute(fixture.database.db)).rows[0].n;
    assert.equal(count,50);
    assert.deepEqual((await sql`SELECT revision_id FROM _cms_revision_prune_queue WHERE entry_id=${initial.id}`.execute(fixture.database.db)).rows,[]);
    const item=await service.getContent({type:'post',id:initial.id});assert.equal(item.status,'draft');
    assert.ok(await revisions.findById(item.draftRevisionId!));
  } finally {await Promise.allSettled(anchored.splice(0));await fixture.close();}
});
