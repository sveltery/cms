// Original raw/scoped D1 atomicity assertions;0 Source callbacks/security credit.
// Explicit fixture DDL is not canonical redirect startup or deployed hosting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {sql,type Kysely} from 'kysely';
import type {D1Database} from '@cloudflare/workers-types';
import {openD1} from '../src/lib/server/database/d1.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService,type ServerPrincipal} from '../src/lib/server/database/service.ts';
import {createRequestScopedDb} from '../src/lib/server/runtime/cloudflare-d1.ts';
import {installRedirectTables} from '../src/lib/server/redirects/migrations/index.ts';
import {RedirectRepository} from '../src/lib/server/redirects/repository.ts';
import type {Database} from '../src/lib/server/redirects/database-types.ts';
import type {DraftEntry} from '../src/lib/server/database/contract.ts';

const expected=(item:DraftEntry)=>({version:item.version,updatedAt:item.updatedAt});
async function fixture(mode:'raw'|'scoped') {
 const worker=new Miniflare({modules:true,script:'export default {fetch(){return new Response("fixture")}}',
  compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,d1Databases:{CMS_DB:`redirect-content-${mode}`},cf:false});
 const binding=await worker.getD1Database('CMS_DB');const storage=openD1(binding);
 await migrateCms(storage);const registry=new SchemaRegistry(storage);
 await registry.createCollection({slug:'posts',label:'Posts',supports:[]});
 await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
 await installRedirectTables(storage.db as unknown as Kysely<unknown>);
 const scope=mode==='scoped'?createRequestScopedDb({config:{binding:'CMS_DB',session:'auto'},
  binding:binding as unknown as D1Database,isAuthenticated:false,isWrite:true,
  cookies:{get:()=>undefined,set(){}},url:new URL('https://cms.test/posts')}):null;
 if(mode==='scoped')assert.ok(scope);
 const database=scope?.database??storage;
 const principal:ServerPrincipal={id:'ordinary-author',permissions:['schema:read','schema:manage','content:create',
  'content:read','content:read_drafts','content:edit_any','content:publish_any']};
 const deferred:Array<()=>void|Promise<void>>=[];
 const service=cmsService(database,principal,{after:task=>deferred.push(task)});
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 const repository=new RedirectRepository(db);
 return {database,db,repository,service,deferred,async close(){
  for(const task of deferred.splice(0))await task();if(scope)await scope.database.close();await storage.close();await worker.dispose();
 }};
}

for(const mode of ['raw','scoped'] as const) {
 test(`actual ${mode} D1 content save commits redirects and collapses/reverts its chain`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   let item=await f.service.createContent({type:'posts',slug:'a',data:{title:'Original'}});
   item=await f.service.updateContent({type:'posts',id:item.id,slug:'b',expected:expected(item)});
   assert.equal((await f.repository.findBySource('/posts/a'))?.destination,'/posts/b');
   item=await f.service.updateContent({type:'posts',id:item.id,slug:'c',expected:expected(item)});
   assert.equal((await f.repository.findBySource('/posts/a'))?.destination,'/posts/c');
   item=await f.service.updateContent({type:'posts',id:item.id,slug:'a',expected:expected(item)});
   assert.equal(item.slug,'a');assert.equal(await f.repository.findBySource('/posts/a'),null);
   assert.equal((await f.repository.findBySource('/posts/c'))?.destination,'/posts/a');
   assert.equal(f.deferred.length,3);await f.deferred.shift()!();
   assert.notEqual((await f.db.selectFrom('_cms_redirect_state').select('generation').executeTakeFirst())?.generation,null);
  }finally{await f.close();}
 });

 test(`actual ${mode} D1 redirect failure rolls content back in the same physical batch`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const item=await f.service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
   await sql`CREATE TRIGGER original_redirect_batch_failure BEFORE INSERT ON _cms_redirects
    BEGIN SELECT RAISE(ABORT,'original redirect failure'); END`.execute(f.db);
   let rejected=false;
   try{await f.service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)});}catch{rejected=true;}
   assert.equal(rejected,true);
   assert.equal((await f.service.getContent({type:'posts',id:item.id})).slug,'old');
   assert.equal((await f.service.getContent({type:'posts',id:item.id})).version,item.version);
   assert.equal(await f.repository.findBySource('/posts/old'),null);assert.equal(f.deferred.length,0);
   assert.equal((await sql`SELECT token FROM _cms_guards`.execute(f.database.db)).rows.length,0);
  }finally{await f.close();}
 });

 test(`actual ${mode} D1 occupied redirect lease refuses the whole content save`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const item=await f.service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
   await sql`UPDATE _cms_redirect_write_lock SET token='ordinary-existing-writer',expires_at=${Date.now()+30_000} WHERE id=1`.execute(f.db);
   let rejected=false;
   try{await f.service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)});}catch{rejected=true;}
   assert.equal(rejected,true);assert.equal((await f.service.getContent({type:'posts',id:item.id})).slug,'old');
   assert.equal(await f.repository.findBySource('/posts/old'),null);assert.equal(f.deferred.length,0);
   assert.equal((await f.db.selectFrom('_cms_redirect_write_lock').select('token').executeTakeFirst())?.token,'ordinary-existing-writer');
  }finally{await f.close();}
 });
}
