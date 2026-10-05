// Native stored-SQL rollback requirements for USER99-DISABLED-ATOMIC-01.
// Supplementary reviewer witness preserves Source single-row update rollback;
// no copied Source, HTTP, credential, session or concurrent-authentication credit.
import {test} from 'vitest';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {openD1} from '../../src/lib/server/database/d1.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {asyncD1Storage} from '../helpers/async-d1-storage.ts';
import {UserRepository} from '../../src/lib/server/users/repository.ts';
import {accountsRepository} from '../../src/lib/server/accounts/repository.ts';

for(const target of ['Node SQLite','raw workerd D1'] as const){
 for(const disabled of [true,false]){
  test(`${target}: rejected profile update rolls back ${disabled?'disable':'enable'} and preserves all stored user/profile bytes`,async()=>{
   const d1=target==='raw workerd D1'?await asyncD1Storage():undefined;
   const database=d1?openD1(d1.binding):openSqlite(':memory:');
   try{
    await migrateCms(database);
    const users=new UserRepository(database),admin=await users.create({email:'admin@example.test',role:'admin'}),author=await users.create({email:'author@example.test',role:'author',data:{custom:'keep'}});
    await database.db.updateTable('_cms_auth_users').set({disabled:disabled?0:1}).where('id','=',author.id).execute();
    const before=await database.db.selectFrom('_cms_auth_users').selectAll().where('id','=',author.id).executeTakeFirstOrThrow();
    const profileBefore=await database.db.selectFrom('_cms_auth_profiles').selectAll().where('user_id','=',author.id).executeTakeFirstOrThrow();
    await sql`CREATE TRIGGER operator_reject_profile BEFORE UPDATE ON _cms_auth_profiles BEGIN SELECT RAISE(ABORT,'operator profile rejection'); END`.execute(database.db);
    await assert.rejects(()=>accountsRepository(database).setDisabled(author.id,admin.id,disabled),/operator profile rejection/);
    assert.deepEqual(await database.db.selectFrom('_cms_auth_profiles').selectAll().where('user_id','=',author.id).executeTakeFirstOrThrow(),profileBefore);
    assert.deepEqual(await database.db.selectFrom('_cms_auth_users').selectAll().where('id','=',author.id).executeTakeFirstOrThrow(),before);
   }finally{await database.close();await d1?.runtime.dispose();}
  });
 }
}
