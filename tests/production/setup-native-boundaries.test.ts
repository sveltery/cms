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
