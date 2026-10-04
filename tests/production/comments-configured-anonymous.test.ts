// Original ordinary public feature proof through UNREPLACED built runtime hooks.
// Ordinary canonical startup supplies complete comment storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { cmsService } from '../../src/lib/server/database/service.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';
for(const target of ['Node SQLite','raw D1'] as const){
 test(`comments ${target} configured built runtime accepts anonymous ordinary submission`,{timeout:30000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-comments-runtime-'));
  const path=join(directory,'comments.db');
  const worker=target==='raw D1'?await asyncD1Storage():undefined;
  const database=worker?openD1(worker.binding):openSqlite(path);
  try{
   await migrateCms(database);
   const registry=new SchemaRegistry(database);
   await registry.createCollection({slug:'post',label:'Posts'});
   await registry.createField('post',{slug:'title',label:'Title',type:'string'});
   await database.db.insertInto('_cms_auth_users').values({id:'content-author',role:50,disabled:0}).execute();
   const now=new Date().toISOString();
   await database.db.insertInto('_cms_auth_profiles').values({user_id:'content-author',email:'author@example.com',name:'Author',email_verified:1,avatar_url:null,data:null,created_at:now,updated_at:now}).execute();
   const principal={id:'content-author',permissions:['content:create','content:publish_any'] as const};
   const content=await cmsService(database,principal).createContent({type:'post',slug:'article',data:{title:'Article'}});
   await lifecycleService(database,principal).publish({type:'post',id:content.id});
   await sql`UPDATE _cms_collections SET comments_enabled=1, comments_moderation='first_time', comments_auto_approve_users=1 WHERE slug='post'`.execute(database.db);
   const built=(file:string)=>import(new URL(`../../.svelte-kit/output/server/${file}`,import.meta.url).href);
   const {manifest}=await built('manifest.js');const {Server}=await built('index.js');const server=new Server(manifest);
   await server.init({env:worker?{}:{SVELTERY_DATABASE_PATH:path,SVELTERY_PUBLIC_ORIGIN:'http://comments.test'}});
   const before=(await sql`SELECT name,sql FROM sqlite_schema ORDER BY name`.execute(database.db)).rows;
   const response=await server.respond(new Request(`http://comments.test/api/comments/post/${content.id}`,{method:'POST',headers:{origin:'http://comments.test','content-type':'application/json'},body:JSON.stringify({authorName:'Visitor',authorEmail:'visitor@example.com',body:'Anonymous comment'})}),{getClientAddress:()=> '127.0.0.1',...(worker?{platform:{env:{CMS_DB:worker.binding,CMS_PUBLIC_ORIGIN:'http://comments.test'}}}:{})});
   assert.equal(response.status,201);
   const created=(await response.json()).data;assert.equal(created.status,'pending');
   const stored=(await sql<{author_user_id:string|null;author_name:string}>`SELECT author_user_id,author_name FROM _cms_comments WHERE id=${created.id}`.execute(database.db)).rows[0];
   assert.equal(stored.author_user_id,null);assert.equal(stored.author_name,'Visitor');
   assert.deepEqual((await sql`SELECT name,sql FROM sqlite_schema ORDER BY name`.execute(database.db)).rows,before);
  } finally {await database.close();await worker?.runtime.dispose();await rm(directory,{recursive:true,force:true});}
 });
}
