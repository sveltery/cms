// Original single-principal HTTP transport assertions; no Source/auth credit.
// Explicit fixture tables do not establish canonical startup or deployed support.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql,type Kysely} from 'kysely';
import {Miniflare} from 'miniflare';
import type {D1Database} from '@cloudflare/workers-types';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {openD1} from '../src/lib/server/database/d1.ts';
import {createRequestScopedDb} from '../src/lib/server/runtime/cloudflare-d1.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {installRedirectTables} from '../src/lib/server/redirects/migrations/index.ts';
import {RedirectRepository} from '../src/lib/server/redirects/repository.ts';
import type {Database} from '../src/lib/server/redirects/database-types.ts';
import {servicePrincipal} from '../src/lib/server/auth/composition.ts';
import {Role} from '../src/lib/server/auth/roles.ts';
import {redirectEndpoint,type RedirectAction} from '../src/lib/server/redirects/request.ts';

async function fixture(redirects=true,mode:'node'|'raw'|'scoped'='node') {
 const worker=mode==='node'?null:new Miniflare({modules:true,script:'export default {fetch(){return new Response("ordinary API fixture")}}',
  compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,d1Databases:{CMS_DB:`redirect-http-${mode}`},cf:false});
 const binding=worker?await worker.getD1Database('CMS_DB'):null;
 const storage=binding?openD1(binding):openSqlite(':memory:');await migrateCms(storage);
 const scope=mode==='scoped'?createRequestScopedDb({config:{binding:'CMS_DB',session:'auto'},binding:binding as unknown as D1Database,
  isAuthenticated:false,isWrite:true,cookies:{get:()=>undefined,set(){}},url:new URL('https://cms.test/api/redirects')}):null;
 if(mode==='scoped')assert.ok(scope);
 const database=scope?.database??storage;
 if(redirects)await installRedirectTables(database.db as unknown as Kysely<unknown>);
 // Real options behavior is a Source dependency; this is fixture-only DDL.
 await sql`CREATE TABLE options(name TEXT PRIMARY KEY,value TEXT NOT NULL,revision TEXT NOT NULL DEFAULT '0')`.execute(database.db);
 const principal=servicePrincipal({id:'ordinary-admin',role:Role.ADMIN});assert.ok(principal);
 const locals={cms:{database,principal,mutationsEnabled:true}};
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 return {database,locals,repository:new RedirectRepository(db),
  request(action:RedirectAction,{query='',body,id,method='GET',raw,headers}:{query?:string;body?:unknown;id?:string;method?:string;raw?:string;headers?:HeadersInit}={}){
   const url=new URL(`https://cms.test/api/redirects${query}`);
   return redirectEndpoint({url,locals,params:{id},request:new Request(url,{method,
    ...(body===undefined&&raw===undefined?{}:{body:raw??JSON.stringify(body)}),headers})},action);
  },async close(){if(scope)await scope.database.close();await storage.close();await worker?.dispose();}};
}

test('actual trusted redirect HTTP transport creates, lists, edits and deletes through Source handlers',async()=>{
 const f=await fixture();try {
  const created=await f.request('create',{method:'POST',body:{source:'/from',destination:'/to',type:308,groupName:'Campaign'}});
  assert.equal(created.status,201);assert.equal(created.headers.get('cache-control'),'private, no-store');
  const {data}=await created.json();assert.equal(data.type,308);assert.equal(data.groupName,'Campaign');
  assert.equal((await f.repository.findById(data.id))?.destination,'/to');
  const duplicate=await f.request('create',{method:'POST',body:{source:'/from',destination:'/elsewhere'}});
  assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).error.code,'CONFLICT');
  const listed=await f.request('list',{query:'?limit=1&group=Campaign&enabled=true&auto=false'});
  assert.equal(listed.status,200);assert.equal((await listed.json()).data.items[0].id,data.id);
  const edited=await f.request('update',{method:'PUT',id:data.id,body:{type:410}});
  assert.equal(edited.status,200);assert.equal((await edited.json()).data.destination,'');
  const fetched=await f.request('get',{id:data.id});assert.equal((await fetched.json()).data.type,410);
  const deleted=await f.request('delete',{method:'DELETE',id:data.id});assert.equal(deleted.status,200);
  assert.deepEqual((await deleted.json()).data,{deleted:true});assert.equal(await f.repository.findById(data.id),null);
  const missing=await f.request('get',{id:data.id});assert.equal(missing.status,404);
 }finally{await f.close();}
});
test('actual redirect HTTP parsing preserves Source JSON, path and pagination diagnostics',async()=>{
 const f=await fixture();try {
  const invalidJson=await f.request('create',{method:'POST',raw:'{'});
  assert.equal(invalidJson.status,400);assert.equal((await invalidJson.json()).error.code,'INVALID_JSON');
  const invalidPath=await f.request('create',{method:'POST',body:{source:'//host/path',destination:'/valid'}});
  assert.equal(invalidPath.status,400);assert.equal((await invalidPath.json()).error.details.issues[0].path,'source');
  const invalidQuery=await f.request('list',{query:'?enabled=wrong'});
  assert.equal(invalidQuery.status,400);assert.equal((await invalidQuery.json()).error.code,'VALIDATION_ERROR');
  const invalidCursor=await f.request('list',{query:'?cursor=bad-cursor'});
  assert.equal(invalidCursor.status,400);assert.equal((await invalidCursor.json()).error.code,'INVALID_CURSOR');
  const tooLarge=await f.request('create',{method:'POST',body:{},headers:{'Content-Length':String(10*1024*1024+1)}});
  assert.equal(tooLarge.status,413);assert.equal((await tooLarge.json()).error.code,'PAYLOAD_TOO_LARGE');
 }finally{await f.close();}
});
test('actual redirect HTTP 404 summary, pruning and clearing mutate real stored paths',async()=>{
 const f=await fixture();try {
  await f.repository.log404({path:'/missing',referrer:'https://example.test'});await f.repository.log404({path:'/missing'});
  await f.repository.log404({path:'/another'});
  const summary=await f.request('summary404',{query:'?limit=1'});assert.equal(summary.status,200);
  assert.equal((await summary.json()).data.items[0].count,2);
  const list=await f.request('list404',{query:'?search=missing'});assert.equal((await list.json()).data.items.length,1);
  const prune=await f.request('prune404',{method:'POST',body:{olderThan:'2099-01-01T00:00:00Z'}});
  assert.equal(prune.status,200);assert.equal((await prune.json()).data.deleted,2);
  await f.repository.log404({path:'/final'});
  const clear=await f.request('clear404',{method:'DELETE'});assert.equal((await clear.json()).data.deleted,1);
 }finally{await f.close();}
});
test('current canonical redirect HTTP storage returns 503 without creating redirect tables',async()=>{
 const f=await fixture(false);try {
  const response=await f.request('list');assert.equal(response.status,503);
  assert.equal((await response.json()).error.code,'MIGRATION_REQUIRED');
  assert.equal((await sql`SELECT name FROM sqlite_master WHERE name='_cms_redirects'`.execute(f.database.db)).rows.length,0);
 }finally{await f.close();}
});
for(const mode of ['raw','scoped'] as const) {
 test(`actual ${mode} D1 trusted redirect HTTP CRUD and 404 transport reaches persisted rows`,{timeout:30_000},async()=>{
  const f=await fixture(true,mode);try {
   const response=await f.request('create',{method:'POST',body:{source:'/from',destination:'/to',type:307}});
   assert.equal(response.status,201);const {data}=await response.json();assert.equal(data.type,307);
   assert.equal((await f.repository.findById(data.id))?.destination,'/to');
   const list=await f.request('list',{query:'?search=from&limit=100'});assert.equal((await list.json()).data.items[0].id,data.id);
   const update=await f.request('update',{method:'PUT',id:data.id,body:{type:451}});assert.equal(update.status,200);
   assert.equal((await f.repository.findById(data.id))?.destination,'');
   await f.repository.log404({path:'/missing'});await f.repository.log404({path:'/missing'});
   const summary=await f.request('summary404');assert.equal((await summary.json()).data.items[0].count,2);
   const prune=await f.request('prune404',{method:'POST',body:{olderThan:'2099-01-01T00:00:00Z'}});assert.equal((await prune.json()).data.deleted,1);
   const deleted=await f.request('delete',{method:'DELETE',id:data.id});assert.equal(deleted.status,200);
   assert.equal(await f.repository.findById(data.id),null);
  }finally{await f.close();}
 });
}
