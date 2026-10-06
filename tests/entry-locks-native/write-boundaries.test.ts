// Native direct-service supplements on real storage and controlled stored principals.
// Zero Original Source/HTTP/session/credential/race credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { databaseSnapshot } from '../helpers/lifecycle-startup.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { cmsService, type ServerPrincipal } from '../../src/lib/server/database/service.ts';
import { EntryLockRepository } from '../../src/lib/server/entry-locks/repository.ts';
const writer:ServerPrincipal={id:'writer',permissions:['content:create','content:read','content:read_drafts','content:edit_own','content:delete_own','content:publish_own']};
const expected=(entry:{version:number;updatedAt:string})=>({version:entry.version,updatedAt:entry.updatedAt});
const actions=['updateContent','publish','schedule','unschedule','unpublish','discardDraft','restoreRevision','deleteContent'] as const;
async function fixture(mode:'Node'|'D1',action:typeof actions[number]='updateContent'){
 const storage=await schemaAdminStorage(mode);
 try{
  await migrateCms(storage.database);
  const registry=new SchemaRegistry(storage.database);
  await registry.createCollection({slug:'post',label:'Posts'});
  await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  await sql`INSERT INTO _cms_auth_users(id,role,disabled) VALUES('writer',40,0),('holder',40,0),('other',40,0)`.execute(storage.database.db);
  await sql`INSERT INTO _cms_auth_profiles(user_id,email,name,created_at,updated_at) VALUES('holder','holder@example.invalid','Ada',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))`.execute(storage.database.db);
  const deferred:(()=>void|Promise<void>)[]=[];
  const life=lifecycleService(storage.database,writer,{after:task=>deferred.push(task)});
  let entry=await life.createContent({type:'post',slug:'story',data:{title:'Original'}});
  const key={type:'post',id:entry.id,locale:'en'};
  if(action==='unschedule')entry=await life.schedule({...key,expected:expected(entry),scheduledAt:'2099-01-02T03:04:05.000Z'});
  if(action==='unpublish'||action==='discardDraft'||action==='restoreRevision')entry=await life.publish({...key,expected:expected(entry)});
  const revisionId=entry.liveRevisionId;
  if(action==='discardDraft')entry=(await life.updateContent({...key,expected:expected(entry),data:{title:'Draft stage'}})).item;
  const locks=new EntryLockRepository(storage.database);
  const held=await locks.acquire({collection:'post',entryId:entry.id,userId:'holder',token:'holder-tab',leaseSeconds:420});
  assert.equal(held.outcome,'acquired');
  const ordinary=cmsService(storage.database,writer,{after:task=>deferred.push(task)});
  async function close(){try{for(const task of deferred.splice(0))await task();}finally{await storage.close();}}
  return {...storage,close,life,ordinary,entry,key,revisionId,locks,holder:held.lock};
 }catch(cause){await storage.close();throw cause;}
}
for(const mode of ['Node','D1'] as const){
 for(const action of actions)test(mode+': '+action+' refuses the other live holder before stale CAS',async t=>{
  const subject=await fixture(mode,action);t.after(subject.close);
  const before=await databaseSnapshot(subject.database);
  const input={...subject.key,expected:{version:999,updatedAt:subject.entry.updatedAt},
   ...(action==='updateContent'?{data:{title:'Refused'}}:{}),
   ...(action==='schedule'?{scheduledAt:'2099-02-03T04:05:06.000Z'}:{}),
   ...(action==='restoreRevision'?{revisionId:subject.revisionId}: {})};
  const operation=action==='deleteContent'?()=>subject.ordinary.deleteContent(input):()=>subject.life[action](input);
  await assert.rejects(operation,(cause:unknown)=>{
   assert.equal((cause as {code:string}).code,'ENTRY_LOCKED');
   assert.deepEqual((cause as {details:unknown}).details,{userId:'holder',userName:'Ada',acquiredAt:subject.holder.acquiredAt,expiresAt:subject.holder.expiresAt});
   return true;
  });
  assert.deepEqual(await databaseSnapshot(subject.database),before);
 });

 test(mode+': permission and ownership denials occur before holder disclosure, including override',async t=>{
  const subject=await fixture(mode);t.after(subject.close);
  const input={...subject.key,expected:expected(subject.entry),data:{title:'Forbidden'},overrideLock:true};
  for(const principal of [{id:'writer',permissions:[]},{id:'other',permissions:['content:edit_own']} ] as ServerPrincipal[]){
   await assert.rejects(()=>lifecycleService(subject.database,principal).updateContent(input),(cause:unknown)=>{
    assert.equal((cause as {code:string}).code,'FORBIDDEN');assert.equal((cause as {details?:unknown}).details,undefined);return true;
   });
  }
  assert.equal((await subject.locks.findLive('post',subject.entry.id))!.userId,'holder');
 });

 test(mode+': only exact boolean override bypasses the lease and it does not become live metadata',async t=>{
  const subject=await fixture(mode,'unpublish');t.after(subject.close);
  const input={...subject.key,expected:expected(subject.entry),data:{title:'Writer draft'}};
  await assert.rejects(()=>subject.life.updateContent({...input,overrideLock:'true'}),{code:'VALIDATION_ERROR'});
  await assert.rejects(()=>subject.life.updateContent({...input,overrideLock:false}),{code:'ENTRY_LOCKED'});
  const saved=await subject.life.updateContent({...input,overrideLock:true});
  assert.equal(saved.liveContentChanged,false);assert.equal(saved.item.liveData!.title,'Original');assert.equal(saved.item.data.title,'Writer draft');
  assert.equal((await subject.locks.findLive('post',subject.entry.id))!.userId,'holder');
 });

 test(mode+': successful authorized deletion clears the actual other-holder lease in the existing batch',async t=>{
  const subject=await fixture(mode,'deleteContent');t.after(subject.close);
  await subject.ordinary.deleteContent({...subject.key,expected:expected(subject.entry),overrideLock:true});
  assert.equal(await subject.locks.findLive('post',subject.entry.id),null);
  assert.equal((await sql<{deleted_at:string|null}>`SELECT deleted_at FROM ec_post WHERE id=${subject.entry.id}`.execute(subject.database.db)).rows[0].deleted_at!==null,true);
  assert.equal((await sql`SELECT * FROM _cms_guards`.execute(subject.database.db)).rows.length,0);
 });

 test(mode+': a genuine failed delete CAS retains content and lease and rolls back both guards',async t=>{
  const subject=await fixture(mode,'deleteContent');t.after(subject.close);
  const before=await databaseSnapshot(subject.database);
  await assert.rejects(()=>subject.ordinary.deleteContent({...subject.key,expected:{version:999,updatedAt:subject.entry.updatedAt},overrideLock:true}),{code:'CONFLICT'});
  assert.deepEqual(await databaseSnapshot(subject.database),before);
  assert.equal((await subject.locks.findLive('post',subject.entry.id))!.userId,'holder');
  assert.equal((await sql`SELECT * FROM _cms_guards`.execute(subject.database.db)).rows.length,0);
 });
}
