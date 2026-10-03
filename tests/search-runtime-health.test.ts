import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import type {RequestEvent} from '@sveltejs/kit';
import {createCmsRuntime} from '../src/lib/server/runtime/composition.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {FTSManager} from '../src/lib/server/search/fts-manager.ts';
import type {Kysely} from 'kysely';
import type {Database} from '../src/lib/server/database/lifecycle/upstream/database/types.ts';
const requestEvent=()=>({request:new Request('http://cms.test/api/search?q=needle'),url:new URL('http://cms.test/api/search?q=needle'),locals:{},cookies:{get:()=>undefined}} as unknown as RequestEvent);
for(const target of ['Node','D1'] as const) test(`${target}: real runtime exposes lazy isolated single-flight FTS health`,async()=>{
 const directory=await mkdtemp(join(tmpdir(),'cms-search-health-'));
 const mf=target==='D1'?new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'search-health'}}):undefined;
 const binding=mf?await mf.getD1Database('DB'):undefined;
 const anchored:Promise<void>[]=[];
 const runtime=createCmsRuntime(()=>binding?{kind:'d1',binding,publicOrigin:'http://cms.test',keepAlive:promise=>anchored.push(promise)}:{kind:'sqlite',path:join(directory,'cms.db'),publicOrigin:'http://cms.test',keepAlive:promise=>anchored.push(promise)});
 try{
  const event=requestEvent();await runtime.handle({event,resolve:async()=>new Response('ok')});
  const database=event.locals.cms!.database,registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'notes',label:'Notes',supports:['search']});
  await registry.createField('notes',{slug:'title',label:'Title',type:'string',searchable:true});
  const manager=new FTSManager(database.db as unknown as Kysely<Database>);await manager.enableSearch('notes');await manager.dropFtsTable('notes');
  assert.equal(typeof event.locals.cmsSearch?.ensureHealthy,'function');
  await Promise.all(Array.from({length:6},()=>event.locals.cmsSearch!.ensureHealthy()));
  assert.equal(await manager.ftsTableExists('notes'),true);assert.equal(anchored.length,1);
  await manager.dropFtsTable('notes');
  const next=requestEvent();await runtime.handle({event:next,resolve:async()=>new Response('ok')});
  await next.locals.cmsSearch!.ensureHealthy();
  assert.equal(await manager.ftsTableExists('notes'),false);assert.equal(anchored.length,1);
  await Promise.all(anchored);
 }finally{await runtime.close();await mf?.dispose();await rm(directory,{recursive:true,force:true});}
});
