// Original Native JSON transport requirements using the already authorized
// stored-user/Role/RequestEvent fixture boundary; no signed-session probes.
import {test} from 'vitest';
import assert from 'node:assert/strict';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {openD1} from '../../src/lib/server/database/d1.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {asyncD1Storage} from '../helpers/async-d1-storage.ts';
import {UserRepository} from '../../src/lib/server/users/repository.ts';
import {servicePrincipal} from '../../src/lib/server/auth/composition.ts';
import {GET as list} from '../../src/routes/api/admin/users/+server.ts';
import {GET as detail,PUT as update} from '../../src/routes/api/admin/users/[id]/+server.ts';
import {POST as disable} from '../../src/routes/api/admin/users/[id]/disable/+server.ts';
import {POST as enable} from '../../src/routes/api/admin/users/[id]/enable/+server.ts';
import type {RequestEvent} from '@sveltejs/kit';

for(const target of ['Node SQLite','raw workerd D1'] as const){
 async function fixture(){
  const d1=target==='raw workerd D1'?await asyncD1Storage():undefined;
  const database=d1?openD1(d1.binding):openSqlite(':memory:');await migrateCms(database);
  const users=new UserRepository(database),admin=await users.create({email:'admin@example.test',role:'admin'}),author=await users.create({email:'author@example.test',role:'author',data:{private:'keep'}});
  const origin='https://example.test';
  function context(id?:string,body?:unknown,actor=admin,overrides:Partial<App.Locals['cms']>={},requestOrigin=origin):RequestEvent{
   const url=new URL(origin+'/api/admin/users'+(id?'/'+id:''));
   return{url,params:{id},request:new Request(url,{method:body===undefined?'GET':'PUT',...(body===undefined?{}:{headers:{'content-type':'application/json',origin:requestOrigin},body:JSON.stringify(body)})}),
    locals:{cms:{database,principal:servicePrincipal(actor),mutationsEnabled:true,...overrides},cmsRuntime:{publicOrigin:origin,basePath:'',rpName:'Sveltery CMS'}}} as unknown as RequestEvent;
  }
  return{database,users,admin,author,context,close:async()=>{await database.close();await d1?.runtime.dispose();}};
 }
 test(`${target}: JSON list and detail return actual stored profiles and private no-store responses`,async()=>{
  const f=await fixture();try{const response=await list(f.context());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
   assert.deepEqual((await response.json()).data.items.map((u:any)=>u.email).sort(),['admin@example.test','author@example.test']);
   const result=await detail(f.context(f.author.id));assert.equal(result.status,200);const item=(await result.json()).data.item;
   assert.equal(item.id,f.author.id);assert.equal(Object.hasOwn(item,'data'),false);
  }finally{await f.close();}
 });
 test(`${target}: JSON role and profile changes persist through the real canonical owner`,async()=>{
  const f=await fixture();try{const response=await update(f.context(f.author.id,{name:'Changed',role:40}));assert.equal(response.status,200);
   const user=await f.users.findById(f.author.id);assert.equal(user?.name,'Changed');assert.equal(user?.role,40);assert.deepEqual(user?.data,{private:'keep'});
   assert.equal((await disable(f.context(f.author.id,{}))).status,200);assert.equal((await f.database.db.selectFrom('_cms_auth_users').select('disabled').where('id','=',f.author.id).executeTakeFirstOrThrow()).disabled,1);
   assert.equal((await enable(f.context(f.author.id,{}))).status,200);
  }finally{await f.close();}
 });
 test(`${target}: stored current role denial precedes malformed input`,async()=>{
  const f=await fixture();try{await f.users.update(f.admin.id,{role:'author'});
   const response=await update(f.context(f.author.id,{role:999}));assert.equal(response.status,403);assert.equal((await response.json()).error.code,'FORBIDDEN');
  }finally{await f.close();}
 });
 test(`${target}: existing Origin and mutation opt-in guards deny changes`,async()=>{
  const f=await fixture();try{const before=await f.users.findById(f.author.id);
   const origin=await update(f.context(f.author.id,{name:'Wrong'},f.admin,{},'https://other.example'));assert.equal(origin.status,403);assert.equal((await origin.json()).error.code,'CSRF_REJECTED');
   const optIn=await update(f.context(f.author.id,{name:'Wrong'},f.admin,{mutationsEnabled:false}));assert.equal(optIn.status,503);assert.equal((await optIn.json()).error.code,'MUTATIONS_DISABLED');
   assert.deepEqual(await f.users.findById(f.author.id),before);
  }finally{await f.close();}
 });
 test(`${target}: original missing-ID detail and update semantics are explicit`,async()=>{
  const f=await fixture();try{for(const response of [await detail(f.context()),await update(f.context(undefined,{name:'Wrong'}))]){
   assert.equal(response.status,400);assert.equal((await response.json()).error.code,'MISSING_PARAM');
  }}finally{await f.close();}
 });
 test(`${target}: invalid role and conflicting email return unchanged stored profile`,async()=>{
  const f=await fixture();try{const before=await f.users.findById(f.author.id);
   for(const [body,status,code] of [[{role:41},400,'VALIDATION_ERROR'],[{email:f.admin.email},409,'EMAIL_IN_USE']] as const){
    const response=await update(f.context(f.author.id,body));assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);
    assert.deepEqual(await f.users.findById(f.author.id),before);
   }
  }finally{await f.close();}
 });
}
