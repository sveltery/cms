// Original actual registered Kit route coverage; no authentication/Source credit.
// One trusted pre-resolved principal; no sessions, signatures or protected probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql,type Kysely} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {servicePrincipal} from '../../src/lib/server/auth/composition.ts';
import {Role} from '../../src/lib/server/auth/roles.ts';
import {installRedirectTables} from '../../src/lib/server/redirects/migrations/index.ts';
import {RedirectRepository} from '../../src/lib/server/redirects/repository.ts';
import type {Database} from '../../src/lib/server/redirects/database-types.ts';

async function fixture(redirects=true){
 const database=openSqlite(':memory:');await migrateCms(database);
 const registry=new SchemaRegistry(database);await registry.createCollection({slug:'posts',label:'Posts',supports:[]});
 await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
 if(redirects)await installRedirectTables(database.db as unknown as Kysely<unknown>);
 await sql`CREATE TABLE options(name TEXT PRIMARY KEY,value TEXT NOT NULL,revision TEXT NOT NULL DEFAULT '0')`.execute(database.db);
 const principal=servicePrincipal({id:'ordinary-route-admin',role:Role.ADMIN});assert.ok(principal);
 const {manifest}=await import('../../.svelte-kit/output/server/manifest.js');
 const {Server}=await import('../../.svelte-kit/output/server/index.js');
 const {options}=await import('../../.svelte-kit/output/server/internal.js');
 const server=new Server(manifest);await server.init({env:{}});
 const original=options.hooks.handle;
 options.hooks.handle=({event,resolve}:any)=>{event.locals.cms={database,principal,mutationsEnabled:true};return resolve(event);};
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 return{database,repository:new RedirectRepository(db),
  request(path:string,method='GET',body?:unknown){return server.respond(new Request(`http://cms.test${path}`,{
   method,headers:{'content-type':'application/json',origin:'http://cms.test'},...(body===undefined?{}:{body:JSON.stringify(body)})
  }),{getClientAddress:()=> '127.0.0.1'});},
  async close(){options.hooks.handle=original;await database.close();}};
}
test('actual registered redirect routes persist CRUD and Source response envelopes',async()=>{
 const f=await fixture();try {
  const created=await f.request('/api/redirects','POST',{source:'/registered',destination:'/actual',type:308});
  assert.equal(created.status,201);assert.equal(created.headers.get('cache-control'),'private, no-store');
  const {data}=await created.json();assert.equal((await f.repository.findById(data.id))?.destination,'/actual');
  const list=await f.request('/api/redirects?search=registered&limit=100');assert.equal(list.status,200);
  assert.equal((await list.json()).data.items[0].id,data.id);
  const updated=await f.request(`/api/redirects/${data.id}`,'PUT',{type:410});assert.equal(updated.status,200);
  assert.equal((await updated.json()).data.destination,'');
  await f.repository.log404({path:'/registered-missing'});await f.repository.log404({path:'/registered-missing'});
  const summary=await f.request('/api/redirects/404s/summary');assert.equal((await summary.json()).data.items[0].count,2);
  const cleared=await f.request('/api/redirects/404s','DELETE');assert.equal((await cleared.json()).data.deleted,1);
  const deleted=await f.request(`/api/redirects/${data.id}`,'DELETE');assert.equal(deleted.status,200);assert.equal(await f.repository.findById(data.id),null);
 }finally{await f.close();}
});
test('actual registered redirect route preserves canonical migration refusal without DDL',async()=>{
 const f=await fixture(false);try {
  const response=await f.request('/api/redirects');assert.equal(response.status,503);
  assert.equal((await response.json()).error.code,'MIGRATION_REQUIRED');
  assert.equal((await sql`SELECT name FROM sqlite_master WHERE name='_cms_redirects'`.execute(f.database.db)).rows.length,0);
 }finally{await f.close();}
});
