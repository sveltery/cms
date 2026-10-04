// Original ordinary storage assertions; no Source/security/protected-probe credit.
// Explicit redirect fixture DDL does not establish canonical startup readiness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {sql,type Kysely} from 'kysely';
import type {D1Database} from '@cloudflare/workers-types';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {openD1} from '../src/lib/server/database/d1.ts';
import {installHistoricalCanonical5} from './helpers/historical-canonical5.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService,type ServerPrincipal} from '../src/lib/server/database/service.ts';
import type {CmsDatabase,DraftEntry} from '../src/lib/server/database/contract.ts';
import {createRequestScopedDb} from '../src/lib/server/runtime/cloudflare-d1.ts';
import {installRedirectTables} from '../src/lib/server/redirects/migrations/index.ts';
import {RedirectRepository,RedirectWriteBusyError} from '../src/lib/server/redirects/repository.ts';
import {RedirectSchemaIncompleteError} from '../src/lib/server/redirects/readiness.ts';
import type {Database} from '../src/lib/server/redirects/database-types.ts';

const expected=(item:DraftEntry)=>({version:item.version,updatedAt:item.updatedAt});
async function fixture(mode:'node'|'raw'|'scoped') {
 const worker=mode==='node'?null:new Miniflare({modules:true,
  script:'export default {fetch(){return new Response("ordinary storage fixture")}}',
  compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,d1Databases:{CMS_DB:`redirect-guards-${mode}`},cf:false});
 const binding=worker?await worker.getD1Database('CMS_DB'):null;
 const storage=binding?openD1(binding):openSqlite(':memory:');
 await installHistoricalCanonical5(storage);const registry=new SchemaRegistry(storage);
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
 const service=(source:CmsDatabase=database)=>cmsService(source,principal,{after:task=>deferred.push(task)});
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 return {database,db,repository:new RedirectRepository(db),service,deferred,async close(){
  for(const task of deferred.splice(0))await task();if(scope)await scope.database.close();await storage.close();await worker?.dispose();
 }};
}

for(const mode of ['node','raw','scoped'] as const) {
 test(`ordinary ${mode} held redirect lease preserves Source busy error and full rollback`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const service=f.service(),item=await service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
   await sql`UPDATE _cms_redirect_write_lock SET token='existing-writer',expires_at=${Date.now()+30_000} WHERE id=1`.execute(f.db);
   await assert.rejects(service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)}),
    error=>error instanceof RedirectWriteBusyError&&error.message==='Another redirect change is in progress');
   assert.equal((await service.getContent({type:'posts',id:item.id})).slug,'old');
   assert.equal(await f.repository.findBySource('/posts/old'),null);assert.equal(f.deferred.length,0);
  }finally{await f.close();}
 });
 test(`ordinary ${mode} changed lease generation rolls shadow removal and content back`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const service=f.service(),item=await service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
   const shadow=await f.repository.create({source:'/posts/new',destination:'/shadow-target'});
   await sql`CREATE TRIGGER original_change_redirect_generation AFTER DELETE ON _cms_redirects
    WHEN OLD.id=${sql.lit(shadow.id)} BEGIN UPDATE _cms_redirect_write_lock SET generation=generation+1 WHERE id=1; END`.execute(f.db);
   await assert.rejects(service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)}));
   assert.equal((await service.getContent({type:'posts',id:item.id})).slug,'old');
   assert.equal((await f.repository.findById(shadow.id))?.destination,'/shadow-target');
   assert.equal(await f.repository.findBySource('/posts/old'),null);assert.equal(f.deferred.length,0);
  }finally{await f.close();}
 });
 test(`ordinary ${mode} partial redirect schema refuses the content save before writing`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const service=f.service(),item=await service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
   await sql`DROP TABLE _cms_404_log`.execute(f.db);
   await assert.rejects(service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)}),RedirectSchemaIncompleteError);
   assert.equal((await service.getContent({type:'posts',id:item.id})).slug,'old');
   assert.equal((await service.getContent({type:'posts',id:item.id})).version,item.version);assert.equal(f.deferred.length,0);
  }finally{await f.close();}
 });
 test(`ordinary ${mode} stale content CAS does not write a redirect or change the externally updated version`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try {
   const item=await f.service().createContent({type:'posts',slug:'old',data:{title:'Original'}});
   let interposed=false;
   const interposedDatabase:CmsDatabase={...f.database,async atomicBatch(statements){
    if(!interposed){interposed=true;await sql`UPDATE ec_posts SET version=version+1 WHERE id=${item.id}`.execute(f.database.db);}
    return f.database.atomicBatch(statements);
   }};
   await assert.rejects(f.service(interposedDatabase).updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)}),
    error=>error instanceof Error&&'code'in error&&error.code==='CONFLICT');
   const retained=await f.service().getContent({type:'posts',id:item.id});
   assert.equal(retained.slug,'old');assert.equal(retained.version,item.version+1);
   assert.equal(await f.repository.findBySource('/posts/old'),null);assert.equal(f.deferred.length,0);
   assert.equal((await sql`SELECT token FROM _cms_guards`.execute(f.database.db)).rows.length,0);
  }finally{await f.close();}
 });
 for(const timestamp of ['Tue, 01 Jan 2030 00:00:00 GMT','2030-01-01T00:00:00.1235Z','not-a-date']) {
  test(`ordinary ${mode} existing redirect timestamp follows Source JS Date for ${timestamp}`,{timeout:30_000},async()=>{
   const f=await fixture(mode);try {
    const service=f.service(),item=await service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
    const manual=await f.repository.create({source:'/posts/old',destination:'/manual-target',type:308,enabled:false,groupName:'Manual'});
    const reference=await f.repository.create({source:'/reference/old',destination:'/manual-target',type:308,enabled:false,groupName:'Manual'});
    await sql`UPDATE _cms_redirects SET updated_at=${timestamp},hits=3 WHERE id IN (${manual.id},${reference.id})`.execute(f.db);
    // Existing public repository retains the pinned complete createAutoRedirect
    // and update bodies; this is an original comparison, no new Source callbacks.
    if(timestamp==='not-a-date') {
     await assert.rejects(f.repository.createAutoRedirect('reference','old','new','ordinary-reference',null),RangeError);
     await assert.rejects(service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)}),RangeError);
     assert.equal((await service.getContent({type:'posts',id:item.id})).slug,'old');assert.equal(f.deferred.length,0);
    }else {
     const upstream=await f.repository.createAutoRedirect('reference','old','new','ordinary-reference',null);assert.ok(upstream);
     await service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)});
     const redirected=await f.repository.findById(manual.id);assert.ok(redirected);
     assert.equal(redirected.updatedAt,upstream.updatedAt);
     assert.equal(redirected.type,308);assert.equal(redirected.auto,false);assert.equal(redirected.enabled,false);
     assert.equal(redirected.groupName,'Manual');assert.equal(redirected.hits,3);
    }
   }finally{await f.close();}
  });
 }
}
