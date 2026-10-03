// Original ordinary storage assertions; no Source/security/protected-probe credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {sql,type Kysely} from 'kysely';
import type {D1Database} from '@cloudflare/workers-types';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {openD1} from '../src/lib/server/database/d1.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService} from '../src/lib/server/database/service.ts';
import {createRequestScopedDb} from '../src/lib/server/runtime/cloudflare-d1.ts';
import {installRedirectTables} from '../src/lib/server/redirects/migrations/index.ts';
import {RedirectRepository,RedirectWriteBusyError} from '../src/lib/server/redirects/repository.ts';
import type {Database} from '../src/lib/server/redirects/database-types.ts';
async function fixture(mode:'node'|'raw'|'scoped'){
 const worker=mode==='node'?null:new Miniflare({modules:true,script:'export default {fetch(){return new Response("ordinary equal-url fixture")}}',
  compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,d1Databases:{CMS_DB:`redirect-equal-${mode}`},cf:false});
 const binding=worker?await worker.getD1Database('CMS_DB'):null,storage=binding?openD1(binding):openSqlite(':memory:');
 await migrateCms(storage);const registry=new SchemaRegistry(storage);
 await registry.createCollection({slug:'posts',label:'Posts',supports:[],urlPattern:'/items/{id}'});
 await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
 await installRedirectTables(storage.db as unknown as Kysely<unknown>);
 const scope=mode==='scoped'?createRequestScopedDb({config:{binding:'CMS_DB',session:'auto'},binding:binding as unknown as D1Database,
  isAuthenticated:false,isWrite:true,cookies:{get:()=>undefined,set(){}},url:new URL('https://cms.test/items')}):null;
 if(mode==='scoped')assert.ok(scope);
 const database=scope?.database??storage,deferred:Array<()=>void|Promise<void>>=[];
 const service=cmsService(database,{id:'ordinary-author',permissions:['content:create','content:read','content:read_drafts','content:edit_any','content:publish_any']},{after:task=>deferred.push(task)});
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 return{database,db,service,deferred,repository:new RedirectRepository(db),async close(){for(const task of deferred.splice(0))await task();if(scope)await scope.database.close();await storage.close();await worker?.dispose();}};
}
for(const mode of ['node','raw','scoped'] as const){
 test(`ordinary ${mode} equal public URLs still acquire and release Source lease without redirect writes`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const item=await f.service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
   // Existing public complete Source repository acquires before URL equality.
   assert.equal(await f.repository.createAutoRedirect('posts','old','new',item.id,'/items/{id}'),null);
   const before=await f.db.selectFrom('_cms_redirect_write_lock').select('generation').executeTakeFirstOrThrow();
   const saved=await f.service.updateContent({type:'posts',id:item.id,slug:'new',expected:{version:item.version,updatedAt:item.updatedAt}});
   assert.equal(saved.slug,'new');
   assert.equal((await f.db.selectFrom('_cms_redirect_write_lock').select('generation').executeTakeFirstOrThrow()).generation,before.generation+1);
   assert.equal((await f.db.selectFrom('_cms_redirects').select('id').execute()).length,0);assert.equal(f.deferred.length,0);
   assert.equal((await f.db.selectFrom('_cms_redirect_write_lock').select('token').executeTakeFirstOrThrow()).token,'');
  }finally{await f.close();}
 });
 test(`ordinary ${mode} equal public URLs preserve Source occupied lease refusal`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const item=await f.service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
   await sql`UPDATE _cms_redirect_write_lock SET token='existing-writer',expires_at=${Date.now()+30_000} WHERE id=1`.execute(f.db);
   await assert.rejects(f.repository.createAutoRedirect('posts','old','new',item.id,'/items/{id}'),RedirectWriteBusyError);
   await assert.rejects(f.service.updateContent({type:'posts',id:item.id,slug:'new',expected:{version:item.version,updatedAt:item.updatedAt}}),RedirectWriteBusyError);
   assert.equal((await f.service.getContent({type:'posts',id:item.id})).slug,'old');assert.equal(f.deferred.length,0);
   assert.equal((await f.db.selectFrom('_cms_redirects').select('id').execute()).length,0);
  }finally{await f.close();}
 });
}
