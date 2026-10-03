import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
import {identityOptions} from '../../src/lib/server/auth/identity-store.ts';
for(const target of ['Node','D1'] as const) {
 test(`${target}: site seed rollback preserves empty content and revisions when promotion fails`,async()=>{
  const seed={version:'1',settings:{},collections:[{slug:'seed_posts',label:'Posts',supports:[],fields:[{slug:'title',label:'Title',type:'string'}]}],content:{seed_posts:[{id:'first',slug:'first',data:{title:'First'}}]}};
  const h=await schemaAdminRemotes(target,true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};(event.locals as any).cmsSetupSeed=seed;}});
  try{
   await h.registry.createCollection({slug:'seed_posts',label:'Posts',supports:[]});await h.registry.createField('seed_posts',{slug:'title',label:'Title',type:'string'});
   await sql`CREATE TRIGGER reject_seed_promotion BEFORE UPDATE OF live_revision_id ON ec_seed_posts WHEN NEW.live_revision_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'seed promotion rejected'); END`.execute(h.database.db);
   const response=await h.request('/api/setup',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({title:'Site',includeContent:true})});
   assert.equal(response.status,500);
   assert.equal((await response.json()).error.code,'SEED_ERROR');
   assert.equal((await sql<{n:number}>`SELECT COUNT(*) n FROM ec_seed_posts`.execute(h.database.db)).rows[0].n,0);
   assert.equal((await sql<{n:number}>`SELECT COUNT(*) n FROM _cms_revisions`.execute(h.database.db)).rows[0].n,0);
   assert.equal(await identityOptions(h.database).get('emdash:setup_state'),null);
  }finally{await h.close();}
 });
 test(`${target}: completed setup wins over malformed seed JSON`,async()=>{
  const h=await schemaAdminRemotes(target,true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};}});
  try{
   await identityOptions(h.database).set('emdash:setup_complete',true);
   const response=await h.request('/api/setup',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:'{'});
   assert.equal(response.status,409);assert.equal((await response.json()).error.code,'ALREADY_CONFIGURED');
  }finally{await h.close();}
 });
}
for(const target of ['Node','D1'] as const) test(`${target}: seeded live revision snapshots stored values and required defaults`,async()=>{
 const seed={version:'1',collections:[{slug:'seed_snapshot',label:'Snapshots',supports:[],fields:[{slug:'title',label:'Title',type:'string'},{slug:'payload',label:'Payload',type:'text'},{slug:'optional',label:'Optional',type:'string'},{slug:'active',label:'Active',type:'boolean'},{slug:'default_title',label:'Default title',type:'string',required:true,defaultValue:'Fallback'}]}],content:{seed_snapshot:[{id:'snapshot',slug:'snapshot',data:{title:'Snapshot',payload:'{"nested":null}',optional:null,active:false}}]}};
 const h=await schemaAdminRemotes(target,true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};(event.locals as any).cmsSetupSeed=seed;}});
 try{
  const response=await h.request('/api/setup',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({title:'Site',includeContent:true})});
  assert.equal(response.status,200);
  const {ContentRepository}=await import('../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts');
  const content=await new ContentRepository(h.database.db as any).findBySlug('seed_snapshot','snapshot');assert.ok(content?.liveRevisionId);
  const revision=(await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE id=${content.liveRevisionId}`.execute(h.database.db)).rows[0];
  assert.deepEqual(JSON.parse(revision.data),content.data);
  assert.deepEqual(content.data,{title:'Snapshot',payload:{nested:null},active:0,default_title:'Fallback'});
 }finally{await h.close();}
});
