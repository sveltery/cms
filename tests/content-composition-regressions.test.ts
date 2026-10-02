// Original native composition requirements, zero copied source assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compositionFixture} from './helpers/content-composition-fixture.ts';
import {cmsService} from '../src/lib/server/database/service.ts';
import {sql} from 'kysely';
const condition=(item:any)=>({version:item.version,updatedAt:item.updatedAt});
async function withFixture(run:(fixture:any)=>Promise<void>){const fixture=await compositionFixture();try{await run(fixture);}finally{await fixture.database.close();}}
for(const status of ['draft','published'])test(`generic ${status} save updates revisions and rejects stale mutations`,()=>withFixture(async f=>{
 const service:any=f.service;assert.equal(typeof service.updateContent,'function');
 const item=await f.repo.create({type:'post',data:{title:'Original',body:'Body'},status});
 const saved=await service.updateContent({type:'post',id:item.id,data:{title:'Edited'},expected:condition(item)});
 assert.equal(saved.data.title,'Edited');assert.equal(saved.data.body,'Body');assert.ok(saved.draftRevisionId);
 if(status==='published')assert.equal(saved.liveData.title,'Original');
 for(const name of ['updateContent','deleteContent'])await assert.rejects(service[name]({type:'post',id:item.id,...(name==='updateContent'?{data:{title:'Stale'}}:{}),expected:condition(item)}),{code:'CONFLICT'});
 await f.lifecycle.publish({type:'post',id:item.id,expected:condition(saved)});
 assert.equal((await f.storage.findById('post',item.id)).data.title,'Edited');
}));
for(const status of ['draft','published'])test(`generic ${status} trash restore retains draft revision and clears live publication`,()=>withFixture(async f=>{
 const service:any=f.service;assert.equal(typeof service.deleteContent,'function');
 const item=await f.repo.create({type:'post',data:{title:'First'},status});
 const saved=await service.updateContent({type:'post',id:item.id,data:{title:'Pending'},expected:condition(item)});
 await service.deleteContent({type:'post',id:item.id,expected:condition(saved)});
 await assert.rejects(service.getContent({type:'post',id:item.id}),{code:'NOT_FOUND'});
 const trashed=await service.getTrashedContent({type:'post',id:item.id});assert.equal(trashed.data.title,'Pending');
 assert.equal(await service.countTrashedContent({type:'post'}),1);
 await assert.rejects(service.restoreContent({type:'post',id:item.id,expected:condition(saved)}),{code:'CONFLICT'});
 const restored=await service.restoreContent({type:'post',id:item.id,expected:condition(trashed)});
 assert.equal(restored.status,'draft');assert.equal(restored.liveRevisionId,null);assert.equal(restored.scheduledAt,null);
 assert.equal(restored.draftRevisionId,saved.draftRevisionId);assert.equal(restored.data.title,'Pending');
 assert.equal(await service.countTrashedContent({type:'post'}),0);
 await assert.rejects(service.restoreContent({type:'post',id:item.id,expected:condition(restored)}),{code:'CONFLICT'});
}));
test('generic ownership, null ownership and read-draft capability remain trusted gates',()=>withFixture(async f=>{
 const item=await f.repo.create({type:'post',data:{title:'Private'},status:'published'});
 const author:any=cmsService(f.database,{id:'someone-else',permissions:['content:read','content:read_drafts','content:edit_own','content:delete_own']});
 assert.equal(typeof author.updateContent,'function');
 for(const name of ['updateContent','deleteContent'])await assert.rejects(author[name]({type:'post',id:item.id,...(name==='updateContent'?{data:{title:'Other'}}:{}),expected:condition(item)}),{code:'FORBIDDEN'});
 await sql`UPDATE ec_post SET author_id=NULL WHERE id=${item.id}`.execute(f.database.db);
 for(const name of ['updateContent','deleteContent'])await assert.rejects(author[name]({type:'post',id:item.id,...(name==='updateContent'?{data:{title:'Ownerless'}}:{}),expected:condition(item)}),{code:'FORBIDDEN'});
 const subscriber:any=cmsService(f.database,{id:'subscriber',permissions:['content:read']});
 for(const name of ['getContent','listContent','getTrashedContent','listTrashedContent','countTrashedContent'])await assert.rejects(subscriber[name]({type:'post',id:item.id}),{code:'FORBIDDEN'});
}));
test('generic lists remain bounded summaries and skipRevision retains only the newest pending autosave',()=>withFixture(async f=>{
 const service:any=f.service;assert.equal(typeof service.listContent,'function');
 const item=await f.repo.create({type:'post',data:{title:'Published',body:'Private body'},status:'published'});
 let saved=item;
 for(const title of ['First auto','Second auto','Third auto'])saved=await service.updateContent({type:'post',id:item.id,data:{title},skipRevision:true,expected:condition(saved)});
 const history=await f.lifecycle.listRevisions({type:'post',id:item.id});
 assert.equal(history.filter((row:any)=>row.id!==item.liveRevisionId).length,1);
 const page=await service.listContent({type:'post',limit:1});assert.equal(page.total,1);assert.equal(page.items[0].title,'Published');
 for(const key of ['data','liveData'])assert.equal(Object.hasOwn(page.items[0],key),false);
 assert.equal((await service.getContent({type:'post',id:item.id})).data.title,'Third auto');
}));
