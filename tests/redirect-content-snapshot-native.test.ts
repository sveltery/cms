// Original ordinary Node storage qualification; no Source concurrency/auth credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql,type Kysely} from 'kysely';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService} from '../src/lib/server/database/service.ts';
import type {CmsDatabase} from '../src/lib/server/database/contract.ts';
import {installRedirectTables} from '../src/lib/server/redirects/migrations/index.ts';
import {up as redirectBase} from '../src/lib/server/redirects/migrations/029_redirects.ts';
import {up as bounded404} from '../src/lib/server/redirects/migrations/035_bounded_404_log.ts';
import {up as redirectGuards} from '../src/lib/server/redirects/migrations/081_redirect_write_guards.ts';
import {up as enableGuard} from '../src/lib/server/redirects/migrations/090_redirect_enable_loop_guard.ts';
import {up as redirectArtifacts} from '../src/lib/server/redirects/migrations/091_redirect_artifacts.ts';
import {RedirectRepository,RedirectWriteBusyError} from '../src/lib/server/redirects/repository.ts';
import type {Database} from '../src/lib/server/redirects/database-types.ts';
async function fixture(interruptedRevisionColumn=false){
 const database=openSqlite(':memory:');await migrateCms(database);const registry=new SchemaRegistry(database);
 await registry.createCollection({slug:'posts',label:'Posts',supports:[]});await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
 const migrationDb=database.db as unknown as Kysely<unknown>;
 if(interruptedRevisionColumn){
  await redirectBase(migrationDb);
  await sql`ALTER TABLE _cms_redirects ADD COLUMN config_revision TEXT`.execute(migrationDb);
  await bounded404(migrationDb);await redirectGuards(migrationDb);await enableGuard(migrationDb);await redirectArtifacts(migrationDb);
 }else await installRedirectTables(migrationDb);
 const deferred:Array<()=>void|Promise<void>>=[];
 const service=(adapter:CmsDatabase=database)=>cmsService(adapter,{id:'ordinary-author',permissions:
  ['content:create','content:read','content:read_drafts','content:edit_any','content:publish_any']},{after:task=>deferred.push(task)});
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 const repository=new RedirectRepository(db),item=await service().createContent({type:'posts',slug:'old',data:{title:'Original'}});
 const manual=await repository.create({source:'/posts/old',destination:'/manual',enabled:false});
 return{database,db,repository,item,manual,service,deferred,async close(){for(const task of deferred.splice(0))await task();await database.close();}};
}
test('ordinary occupied lease precedes invalid stored timestamp as in Source repository',async()=>{
 const f=await fixture();try {
  await sql`UPDATE _cms_redirects SET updated_at='not-a-date' WHERE id=${f.manual.id}`.execute(f.db);
  await sql`UPDATE _cms_redirect_write_lock SET token='existing-writer',expires_at=${Date.now()+30_000} WHERE id=1`.execute(f.db);
  await assert.rejects(f.repository.createAutoRedirect('posts','old','new',f.item.id,null),RedirectWriteBusyError);
  await assert.rejects(f.service().updateContent({type:'posts',id:f.item.id,slug:'new',expected:{version:f.item.version,updatedAt:f.item.updatedAt}}),RedirectWriteBusyError);
  assert.equal((await f.service().getContent({type:'posts',id:f.item.id})).slug,'old');assert.equal(f.deferred.length,0);
 }finally{await f.close();}
});
test('ordinary selected-row snapshot change rolls back then prepares the real replacement state',async()=>{
 const f=await fixture();try {
  let attempts=0;
  const adapter:CmsDatabase={...f.database,async atomicBatch(statements){
   if(++attempts===1)await sql`UPDATE _cms_redirects SET type=308,config_revision='ordinary-new-revision' WHERE id=${f.manual.id}`.execute(f.db);
   return f.database.atomicBatch(statements);
  }};
  const saved=await f.service(adapter).updateContent({type:'posts',id:f.item.id,slug:'new',expected:{version:f.item.version,updatedAt:f.item.updatedAt}});
  assert.equal(saved.slug,'new');assert.equal(attempts,2);assert.equal((await f.repository.findById(f.manual.id))?.type,308);
  assert.equal((await f.repository.findById(f.manual.id))?.destination,'/posts/new');
  assert.equal((await sql`SELECT token FROM _cms_guards`.execute(f.db)).rows.length,0);
 }finally{await f.close();}
});
test('ordinary changing selected-row snapshot exhausts exactly five complete attempts with native conflict',async()=>{
 const f=await fixture();try {
  let attempts=0;
  const adapter:CmsDatabase={...f.database,async atomicBatch(statements){
   await sql`UPDATE _cms_redirects SET config_revision=${`ordinary-revision-${++attempts}`} WHERE id=${f.manual.id}`.execute(f.db);
   return f.database.atomicBatch(statements);
  }};
  await assert.rejects(f.service(adapter).updateContent({type:'posts',id:f.item.id,slug:'new',expected:{version:f.item.version,updatedAt:f.item.updatedAt}}),
   error=>error instanceof Error&&'code'in error&&error.code==='CONFLICT');
  assert.equal(attempts,5);assert.equal((await f.service().getContent({type:'posts',id:f.item.id})).slug,'old');
  assert.equal((await f.repository.findById(f.manual.id))?.destination,'/manual');assert.equal(f.deferred.length,0);
  assert.equal((await sql`SELECT token FROM _cms_guards`.execute(f.db)).rows.length,0);
 }finally{await f.close();}
});
test('ordinary legacy null redirect timestamp follows Source JS acceptance with an exact null snapshot',async()=>{
 const f=await fixture();try {
  const reference=await f.repository.create({source:'/reference/old',destination:'/manual-reference',enabled:false});
  await sql`UPDATE _cms_redirects SET updated_at=NULL WHERE id IN (${f.manual.id},${reference.id})`.execute(f.db);
  const source=await f.repository.createAutoRedirect('reference','old','new','ordinary-reference',null);assert.ok(source);
  assert.equal(Number.isNaN(new Date(source.updatedAt).getTime()),false);
  const saved=await f.service().updateContent({type:'posts',id:f.item.id,slug:'new',expected:{version:f.item.version,updatedAt:f.item.updatedAt}});
  assert.equal(saved.slug,'new');const redirected=await f.repository.findById(f.manual.id);assert.ok(redirected);
  assert.equal(redirected.destination,'/posts/new');assert.equal(Number.isNaN(new Date(redirected.updatedAt).getTime()),false);
  assert.equal(redirected.id,f.manual.id);assert.equal(redirected.enabled,false);
 }finally{await f.close();}
});
test('ordinary interrupted Source guard migration preserves nullable raw configuration revision',async()=>{
 const f=await fixture(true);try {
  const columns=await sql<{name:string;notnull:number}>`PRAGMA table_info(_cms_redirects)`.execute(f.db);
  assert.equal(columns.rows.find(column=>column.name==='config_revision')?.notnull,0);
  assert.equal(columns.rows.find(column=>column.name==='destination')?.notnull,1);
  const reference=await f.repository.create({source:'/reference/old',destination:'/manual-reference',enabled:false});
  await sql`UPDATE _cms_redirects SET config_revision=NULL WHERE id IN (${f.manual.id},${reference.id})`.execute(f.db);
  const source=await f.repository.createAutoRedirect('reference','old','new','ordinary-reference',null);assert.ok(source);
  assert.equal(source.destination,'/reference/new');
  const saved=await f.service().updateContent({type:'posts',id:f.item.id,slug:'new',expected:{version:f.item.version,updatedAt:f.item.updatedAt}});
  assert.equal(saved.slug,'new');const redirected=await f.repository.findById(f.manual.id);assert.ok(redirected);
  assert.equal(redirected.destination,'/posts/new');assert.equal(redirected.id,f.manual.id);assert.equal(redirected.enabled,false);
  assert.equal((await f.repository.findVersionedById(f.manual.id))?.configRevision===null,false);
 }finally{await f.close();}
});
