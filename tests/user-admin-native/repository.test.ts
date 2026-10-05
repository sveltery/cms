// Original Native requirements for whole pinned stored-user administration.
// Source authority: EmDash 1.1.0 / 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e,
// packages/auth/src/adapters/kysely.ts and all four admin/users route modules.
// These are Native requirements; they earn zero copied Source assertion credit.
import {test} from 'vitest';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {openD1} from '../../src/lib/server/database/d1.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {asyncD1Storage} from '../helpers/async-d1-storage.ts';
import {UserRepository} from '../../src/lib/server/users/repository.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';

type Administration=ReturnType<typeof import('../../src/lib/server/accounts/repository.ts').accountsRepository>;
async function administration(database:CmsDatabase):Promise<Administration>{
 const module=await import('../../src/lib/server/accounts/repository.ts').catch(()=>({}));
 assert.equal(typeof (module as any).accountsRepository,'function','actual stored-user administrator owner is available');
 return (module as any).accountsRepository(database);
}
for(const target of ['Node SQLite','raw workerd D1'] as const){
 async function fixture(){
  const d1=target==='raw workerd D1'?await asyncD1Storage():undefined;
  const database=d1?openD1(d1.binding):openSqlite(':memory:');
  try{await migrateCms(database);}catch(cause){await database.close();await d1?.runtime.dispose();throw cause;}
  const users=new UserRepository(database);
  const admin=await users.create({email:'admin@example.test',name:'Admin',role:'admin',data:{custom:'keep'}});
  const author=await users.create({email:'author@example.test',name:'Author',role:'author',data:{custom:'private'}});
  return{database,users,admin,author,close:async()=>{await database.close();await d1?.runtime.dispose();}};
 }
 async function rows(database:CmsDatabase){return{
  users:(await database.db.selectFrom('_cms_auth_users').selectAll().orderBy('id').execute()).map(r=>({...r})),
  profiles:(await database.db.selectFrom('_cms_auth_profiles').selectAll().orderBy('user_id').execute()).map(r=>({...r}))
 };}
 test(`${target}: lists real joined users with safe profile and stored credential summaries`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);const result=await r.list();
   assert.deepEqual(result.items.map(u=>u.email).sort(),['admin@example.test','author@example.test']);
   assert.equal(result.items[0].credentialCount,0);assert.equal(result.items[0].lastLogin,null);
   for(const user of result.items)assert.equal(Object.hasOwn(user,'data'),false);
  }finally{await f.close();}
 });
 test(`${target}: searches email and name and filters exact numeric stored roles`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);
   assert.deepEqual((await r.list({search:'AUTHOR'})).items.map(u=>u.id),[f.author.id]);
   assert.deepEqual((await r.list({search:'example.test',role:50})).items.map(u=>u.id),[f.admin.id]);
   assert.deepEqual((await r.list({search:'absent'})).items,[]);
  }finally{await f.close();}
 });
 test(`${target}: creation-time cursors use original stored timestamp bytes`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);
   await f.database.db.updateTable('_cms_auth_profiles').set({created_at:'2025-01-02 03:04:05'}).where('user_id','=',f.admin.id).execute();
   await f.database.db.updateTable('_cms_auth_profiles').set({created_at:'2025-01-01 03:04:05'}).where('user_id','=',f.author.id).execute();
   const first=await r.list({limit:1});assert.deepEqual(first.items.map(u=>u.id),[f.admin.id]);assert.equal(first.nextCursor,f.admin.id);
   const second=await r.list({limit:1,cursor:first.nextCursor});assert.deepEqual(second.items.map(u=>u.id),[f.author.id]);assert.equal(second.nextCursor,undefined);
   assert.equal((await r.list({cursor:'missing'})).items.length,2);
  }finally{await f.close();}
 });
 test(`${target}: detail returns persisted metadata without private profile JSON or key material`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);const user=await r.detail(f.author.id);
   assert.ok(user);assert.equal(user.name,'Author');assert.equal(user.role,30);assert.deepEqual(user.credentials,[]);
   assert.equal(Object.hasOwn(user,'data'),false);assert.equal(await r.detail('missing'),null);
  }finally{await f.close();}
 });
 test(`${target}: profileless historical rows remain unchanged and counted as unavailable profiles`,async()=>{
  const f=await fixture();try{await f.database.db.insertInto('_cms_auth_users').values({id:'historical',role:50,disabled:0}).execute();
   const before=await rows(f.database);const r=await administration(f.database);const result=await r.list();
   assert.equal(result.legacyCount,1);assert.equal(result.items.length,2);assert.equal(await r.detail('historical'),null);
   await assert.rejects(()=>r.update('historical',f.admin.id,{name:'Invented'}),{code:'NOT_FOUND'});
   assert.deepEqual(await rows(f.database),before);
  }finally{await f.close();}
 });
 test(`${target}: updates stored name email and role while preserving custom JSON`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);const updated=await r.update(f.author.id,f.admin.id,{name:'Changed',email:'CHANGED@example.test',role:40});
   assert.equal(updated.name,'Changed');assert.equal(updated.email,'changed@example.test');assert.equal(updated.role,40);
   assert.deepEqual((await f.users.findById(f.author.id))?.data,{custom:'private'});
  }finally{await f.close();}
 });
 test(`${target}: rejects self-role changes and duplicate email without writes`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);const before=await rows(f.database);
   await assert.rejects(()=>r.update(f.admin.id,f.admin.id,{role:40}),{code:'SELF_ROLE_CHANGE'});
   await assert.rejects(()=>r.update(f.author.id,f.admin.id,{email:f.admin.email}),{code:'EMAIL_IN_USE'});
   assert.deepEqual(await rows(f.database),before);
  }finally{await f.close();}
 });
 test(`${target}: last administrator demotion is rejected using actual enabled stored rows`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);const before=await rows(f.database);
   await assert.rejects(()=>r.update(f.admin.id,f.author.id,{role:40}),{code:'LAST_ADMIN'});assert.deepEqual(await rows(f.database),before);
   await f.users.update(f.author.id,{role:'admin'});await r.update(f.admin.id,f.author.id,{role:40});
   assert.equal((await f.users.findById(f.admin.id))?.role,40);
  }finally{await f.close();}
 });
 test(`${target}: operator rejection rolls back the complete profile and role update`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);
   await sql`CREATE TRIGGER operator_reject_user BEFORE UPDATE ON _cms_auth_users WHEN NEW.role=40 BEGIN SELECT RAISE(ABORT,'operator rejects role'); END`.execute(f.database.db);
   const before=await rows(f.database);await assert.rejects(()=>r.update(f.author.id,f.admin.id,{name:'Rejected',role:40}),/operator rejects role/);
   assert.deepEqual(await rows(f.database),before);
  }finally{await f.close();}
 });
 test(`${target}: disable and enable modify the actual stored account`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);await r.setDisabled(f.author.id,f.admin.id,true);
   assert.equal((await r.detail(f.author.id))?.disabled,true);await r.setDisabled(f.author.id,f.admin.id,false);
   assert.equal((await r.detail(f.author.id))?.disabled,false);assert.deepEqual((await f.users.findById(f.author.id))?.data,{custom:'private'});
  }finally{await f.close();}
 });
 test(`${target}: refuses self disable and disabling the final enabled administrator`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);const before=await rows(f.database);
   await assert.rejects(()=>r.setDisabled(f.admin.id,f.admin.id,true),/Cannot disable your own account/);
   await assert.rejects(()=>r.setDisabled(f.admin.id,f.author.id,true),/Cannot disable the last admin/);
   assert.deepEqual(await rows(f.database),before);
  }finally{await f.close();}
 });
 test(`${target}: missing profile mutations return the Source not-found error`,async()=>{
  const f=await fixture();try{const r=await administration(f.database);
   await assert.rejects(()=>r.requireProfile('missing'),{code:'NOT_FOUND'});
   await assert.rejects(()=>r.setDisabled('missing',f.admin.id,false),{code:'NOT_FOUND'});
  }finally{await f.close();}
 });
}
