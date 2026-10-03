// Original native integration assertions. No Source callback credit.
// Explicit redirect DDL provides no canonical startup/deployment credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql,type Kysely } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { Permissions } from '../src/lib/server/auth/permissions.ts';
import { installRedirectTables } from '../src/lib/server/redirects/migrations/index.ts';
import { RedirectRepository } from '../src/lib/server/redirects/repository.ts';
import type { Database } from '../src/lib/server/redirects/database-types.ts';
import type { DraftEntry } from '../src/lib/server/database/contract.ts';

async function fixture({redirects=true,revisions=false}={}) {
 const database=openSqlite(':memory:');await migrateCms(database);
 const registry=new SchemaRegistry(database);
 await registry.createCollection({slug:'posts',label:'Posts',supports:revisions?['revisions']:[]});
 await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
 if(redirects)await installRedirectTables(database.db as unknown as Kysely<unknown>);
 const principal={id:'author-redirects',permissions:Object.keys(Permissions) as Array<keyof typeof Permissions>};
 const deferred:Array<()=>void|Promise<void>>=[];
 const service=cmsService(database,principal,{after:task=>deferred.push(task)});
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 const repository=new RedirectRepository(db);
 return {database,service,repository,db,deferred,
  async close(){for(const task of deferred.splice(0))await task();await database.close();}};
}
const expected=(item:DraftEntry)=>({version:item.version,updatedAt:item.updatedAt});

test('actual content service slug save persists and publishes its automatic redirect',async()=>{
 const f=await fixture();try {
  const original=await f.service.createContent({type:'posts',locale:'en',slug:'old',data:{title:'Original'}});
  const changed=await f.service.updateContent({type:'posts',id:original.id,locale:'en',slug:'new',expected:expected(original)});
  assert.equal(changed.slug,'new');
  assert.deepEqual(await f.repository.findBySource('/posts/old').then(row=>row&&({source:row.source,destination:row.destination,type:row.type,auto:row.auto})),
   {source:'/posts/old',destination:'/posts/new',type:301,auto:true});
  assert.equal(f.deferred.length,1);
  await f.deferred.shift()!();
  assert.notEqual((await f.db.selectFrom('_cms_redirect_state').select('generation').executeTakeFirst())?.generation,null);
 }finally{await f.close();}
});

test('actual successive content saves collapse chains and a reverted slug stays reachable',async()=>{
 const f=await fixture();try {
  let item=await f.service.createContent({type:'posts',slug:'a',data:{title:'Original'}});
  item=await f.service.updateContent({type:'posts',id:item.id,slug:'b',expected:expected(item)});
  item=await f.service.updateContent({type:'posts',id:item.id,slug:'c',expected:expected(item)});
  assert.equal((await f.repository.findBySource('/posts/a'))?.destination,'/posts/c');
  item=await f.service.updateContent({type:'posts',id:item.id,slug:'a',expected:expected(item)});
  assert.equal(item.slug,'a');
  assert.equal(await f.repository.findBySource('/posts/a'),null);
  assert.equal((await f.repository.findBySource('/posts/c'))?.destination,'/posts/a');
 }finally{await f.close();}
});

test('redirect write failure rolls the actual content save back',async()=>{
 const f=await fixture();try {
  const item=await f.service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
  await sql`CREATE TRIGGER original_reject_redirect_insert BEFORE INSERT ON _cms_redirects
   BEGIN SELECT RAISE(ABORT,'original redirect failure'); END`.execute(f.db);
  let rejected=false;
  try{await f.service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)});}catch{rejected=true;}
  assert.equal(rejected,true);
  const retained=await f.service.getContent({type:'posts',id:item.id});
  assert.equal(retained.slug,'old');assert.equal(retained.version,item.version);
  assert.equal(await f.repository.findBySource('/posts/old'),null);
 }finally{await f.close();}
});

test('a surviving locale holder keeps the old public path available',async()=>{
 const f=await fixture();try {
  const english=await f.service.createContent({type:'posts',locale:'en',slug:'shared',data:{title:'English'}});
  await f.service.createContent({type:'posts',locale:'fr',slug:'shared',data:{title:'French'}});
  const saved=await f.service.updateContent({type:'posts',id:english.id,locale:'en',slug:'changed',expected:expected(english)});
  assert.equal(saved.slug,'changed');assert.equal(await f.repository.findBySource('/posts/shared'),null);
 }finally{await f.close();}
});

test('staging a draft revision leaves live slug and redirects untouched',async()=>{
 const f=await fixture({revisions:true});try {
  const original=await f.service.createContent({type:'posts',slug:'live',data:{title:'Original'}});
  const staged=await f.service.updateContent({type:'posts',id:original.id,slug:'staged',data:{title:'Changed'},expected:expected(original)});
  assert.equal(staged.slug,'live');
  assert.equal(await f.repository.findBySource('/posts/live'),null);
 }finally{await f.close();}
});

test('content updates on current canonical storage preserve zero-redirect-table behavior',async()=>{
 const f=await fixture({redirects:false});try {
  const item=await f.service.createContent({type:'posts',slug:'old',data:{title:'Original'}});
  const saved=await f.service.updateContent({type:'posts',id:item.id,slug:'new',expected:expected(item)});
  assert.equal(saved.slug,'new');
  assert.equal((await sql`SELECT name FROM sqlite_master WHERE name='_cms_redirects'`.execute(f.database.db)).rows.length,0);
 }finally{await f.close();}
});
