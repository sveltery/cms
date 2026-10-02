// Original registered SvelteKit transport requirements; zero source parity credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'devalue';
import {persistedRemotes} from '../helpers/persisted-remotes.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {withRevision} from '../../src/lib/server/content/schema.ts';
import {contentEntry} from '../../src/lib/server/lifecycle/schema.ts';
const actor={id:'user_author',permissions:['content:read','content:read_drafts','content:create','content:edit_own','content:delete_own','content:publish_own']} as any;
const input=(item:any)=>({collection:item.type,id:item.id,locale:item.locale,_rev:withRevision(contentEntry(item))._rev});
const denied=(result:any,status:number,code:string)=>{assert.equal(result.type,'error');assert.equal(result.status,status);assert.equal(result.error.code,code);};
test('generic registered create/save/list and lifecycle publication share one revision backend',async()=>{
 const f=await persistedRemotes({persistedSessions:true,mutationsEnabled:true});
 try{
  const created=await f.mutate('createContent',{collection:'post','data.title':'Ordinary title'});
  const key={collection:'post',id:created._.result.id};const initial=await f.query('getContent',key);
  assert.equal(initial.slug,'ordinary-title');
  await f.mutate('publishContent',{...key,_rev:initial._rev});
  // Retrieve the actual current wire token after publication.
  const published=await f.query('getContent',key);
  const saved=await f.mutate('updateContent',{...key,_rev:published._rev,'data.title':'Pending edit'});
  assert.deepEqual(Object.keys(saved._.result).sort(),['_rev','id','locale','type']);
  const staged=await f.query('getContent',key);assert.equal(staged.data.title,'Pending edit');assert.equal(staged.liveData.title,'Ordinary title');
  denied(await f.remote('updateContent','author',{...key,_rev:published._rev,'data.title':'Stale edit'}),409,'CONFLICT');
  const page=await f.query('listContent',{collection:'post',status:'published',authorId:'user_author',limit:1});
  assert.equal(page.total,1);assert.equal(page.items[0].status,'published');assert.equal(Object.hasOwn(page.items[0],'data'),false);
  await f.mutate('publishContent',{...key,_rev:staged._rev});
  assert.equal((await f.query('getContent',key)).data.title,'Pending edit');
  const history=await f.query('listContentRevisions',key);assert.ok(history.length>=2);
  await f.restart();assert.equal((await f.query('getContent',key)).data.title,'Pending edit');
 }finally{await f.close();}
});
test('generic registered published trash/restore preserves staged data and rejects stale receipts',async()=>{
 const f=await persistedRemotes({persistedSessions:true,mutationsEnabled:true});
 try{
  const service=lifecycleService(f.database,actor,{after:()=>{}});
  const initial=await service.createContent({type:'post',data:{title:'Trash published'},slug:'trash-published'});
  const published=await service.publish({type:'post',id:initial.id});
  const staged=(await service.updateContent({type:'post',id:initial.id,data:{title:'Pending before trash'}})).item;
  const key={collection:'post',id:initial.id};
  const deleted=await f.mutate('deleteContent',input(staged));assert.equal(deleted._.result.trashed,true);
  denied(await f.remote('getContent','author',undefined,key),404,'NOT_FOUND');
  const page=await f.query('listTrashedContent',{collection:'post'});assert.equal(page.items.length,1);assert.equal(Object.hasOwn(page.items[0],'data'),false);
  assert.equal(await f.query('countTrashedContent',{collection:'post'}),1);
  const trashed=await f.query('getTrashedContent',key);assert.equal(trashed.data.title,'Pending before trash');
  denied(await f.remote('restoreContent','author',input(staged)),409,'CONFLICT');
  const restored=await f.mutate('restoreContent',{...key,_rev:trashed._rev});
  const read=await f.query('getContent',key);assert.equal(read.status,'draft');assert.equal(read.liveRevisionId,null);assert.equal(read.draftRevisionId,staged.draftRevisionId);assert.equal(read.data.title,'Pending before trash');
  assert.equal(restored._.result._rev,read._rev);assert.equal(await f.query('countTrashedContent',{collection:'post'}),0);
  await f.restart();assert.equal((await f.query('getContent',key)).data.title,'Pending before trash');
 }finally{await f.close();}
});
