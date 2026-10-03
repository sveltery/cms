// Original ordinary publication storage requirements; no auth/race/Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {sql,type Kysely} from 'kysely';
import type {D1Database} from '@cloudflare/workers-types';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {openD1} from '../src/lib/server/database/d1.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import type {CmsDatabase} from '../src/lib/server/database/contract.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {createRequestScopedDb} from '../src/lib/server/runtime/cloudflare-d1.ts';
import {installRedirectTables} from '../src/lib/server/redirects/migrations/index.ts';
import {RedirectRepository} from '../src/lib/server/redirects/repository.ts';
import type {Database} from '../src/lib/server/redirects/database-types.ts';
const principal={id:'ordinary-author',permissions:['content:create','content:read','content:read_drafts','content:edit_any','content:publish_any'] as const};
async function fixture(mode:'node'|'raw'|'scoped'){
 const worker=mode==='node'?null:new Miniflare({modules:true,script:'export default {fetch(){return new Response("ordinary publication fixture")}}',
  compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,d1Databases:{CMS_DB:`redirect-publication-${mode}`},cf:false});
 const binding=worker?await worker.getD1Database('CMS_DB'):null,storage=binding?openD1(binding):openSqlite(':memory:');
 await migrateCms(storage);const registry=new SchemaRegistry(storage);
 await registry.createCollection({slug:'posts',label:'Posts',supports:['revisions'],urlPattern:'/blog/{slug}'});
 await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
 await installRedirectTables(storage.db as unknown as Kysely<unknown>);
 const scope=mode==='scoped'?createRequestScopedDb({config:{binding:'CMS_DB',session:'auto'},binding:binding as unknown as D1Database,
  isAuthenticated:false,isWrite:true,cookies:{get:()=>undefined,set(){}},url:new URL('https://cms.test/items')}):null;
 if(mode==='scoped')assert.ok(scope);
 const database=scope?.database??storage,deferred:Array<()=>void|Promise<void>>=[];
 const service=(adapter:CmsDatabase=database)=>lifecycleService(adapter,principal,{after:task=>deferred.push(task)});
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 const flush=async()=>{for(const task of deferred.splice(0))await task();};
 return{database,db,service,deferred,flush,repository:new RedirectRepository(db),async close(){await flush();if(scope)await scope.database.close();await storage.close();await worker?.dispose();}};
}
async function staged(f:Awaited<ReturnType<typeof fixture>>){
 const original=await f.service().createContent({type:'posts',slug:'old',data:{title:'Original'}});
 const live=await f.service().publish({type:'posts',id:original.id,expected:{version:original.version,updatedAt:original.updatedAt}});
 const saved=await f.service().updateContent({type:'posts',id:live.id,slug:'new',data:{title:'Promoted'},expected:{version:live.version,updatedAt:live.updatedAt}});
 await f.flush();assert.equal((await f.repository.findBySource('/blog/old')),null);
 return saved.item;
}
for(const mode of ['node','raw','scoped'] as const){
 test(`ordinary ${mode} publishing an already-live changed staged slug commits and publishes its redirect`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try{
   const item=await staged(f);
   const published=await f.service().publish({type:'posts',id:item.id,expected:{version:item.version,updatedAt:item.updatedAt}});
   assert.equal(published.slug,'new');assert.equal(published.data.title,'Promoted');assert.equal(published.draftRevisionId,null);
   assert.equal((await f.repository.findBySource('/blog/old'))?.destination,'/blog/new');
   assert.equal(f.deferred.length,1);await f.flush();
   assert.ok((await f.db.selectFrom('_cms_redirect_state').select('active_generation').executeTakeFirstOrThrow()).active_generation);
  }finally{await f.close();}
 });
 test(`ordinary ${mode} redirect write refusal rolls back publication and retains the actual draft`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try{
   const item=await staged(f),before=(await sql`SELECT * FROM ec_posts WHERE id=${item.id}`.execute(f.db)).rows;
   await sql`CREATE TRIGGER ordinary_publish_redirect_refusal BEFORE INSERT ON _cms_redirects
    BEGIN SELECT RAISE(ABORT,'ordinary-publish-redirect-refusal'); END`.execute(f.db);
   await assert.rejects(f.service().publish({type:'posts',id:item.id,expected:{version:item.version,updatedAt:item.updatedAt}}),/ordinary-publish-redirect-refusal/);
   assert.deepEqual((await sql`SELECT * FROM ec_posts WHERE id=${item.id}`.execute(f.db)).rows,before);
   assert.equal(await f.repository.findBySource('/blog/old'),null);assert.equal(f.deferred.length,0);
  }finally{await f.close();}
 });
 test(`ordinary ${mode} reconciled post-commit transport failure still publishes the actual redirect`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try{
   const item=await staged(f);let physicalCommits=0;
   const transport:CmsDatabase={...f.database,async atomicBatch(statements){
    await f.database.atomicBatch(statements);physicalCommits++;throw new Error('ordinary unconfirmed transport response failure');
   }};
   const published=await f.service(transport).publish({type:'posts',id:item.id,expected:{version:item.version,updatedAt:item.updatedAt}});
   assert.equal(published.slug,'new');assert.equal(published.data.title,'Promoted');
   assert.equal((await f.repository.findBySource('/blog/old'))?.destination,'/blog/new');assert.equal(physicalCommits,1);
   assert.equal(f.deferred.length,1);await f.flush();
   assert.ok((await f.db.selectFrom('_cms_redirect_state').select('active_generation').executeTakeFirstOrThrow()).active_generation);
  }finally{await f.close();}
 });
 test(`ordinary ${mode} unconfirmed pre-commit transport failure cannot publish content or artifacts`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try{
   const item=await staged(f),before=(await sql`SELECT * FROM ec_posts WHERE id=${item.id}`.execute(f.db)).rows;
   const transport:CmsDatabase={...f.database,async atomicBatch(){throw new Error('ordinary unconfirmed transport before commit');}};
   await assert.rejects(f.service(transport).publish({type:'posts',id:item.id,expected:{version:item.version,updatedAt:item.updatedAt}}),/ordinary unconfirmed transport before commit/);
   assert.deepEqual((await sql`SELECT * FROM ec_posts WHERE id=${item.id}`.execute(f.db)).rows,before);
   assert.equal(await f.repository.findBySource('/blog/old'),null);assert.equal(f.deferred.length,0);
  }finally{await f.close();}
 });
 test(`ordinary ${mode} first publish promotes its draft without creating or publishing a redirect`,{timeout:30_000},async()=>{
  const f=await fixture(mode);try{
   const original=await f.service().createContent({type:'posts',slug:'never-public',data:{title:'Original'}});
   const staged=await f.service().updateContent({type:'posts',id:original.id,slug:'first-public',data:{title:'First'},expected:{version:original.version,updatedAt:original.updatedAt}});
   await f.flush();const item=staged.item;
   const published=await f.service().publish({type:'posts',id:item.id,expected:{version:item.version,updatedAt:item.updatedAt}});
   assert.equal(published.slug,'first-public');assert.equal(published.status,'published');
   assert.equal((await f.db.selectFrom('_cms_redirects').select('id').execute()).length,0);assert.equal(f.deferred.length,0);
  }finally{await f.close();}
 });
}
