// Original native guard/session-storage composition; no duplicate auth credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
import {identityDb} from '../../src/lib/server/auth/identity-store.ts';
for(const target of ['Node','D1'] as const){
 test(`${target}: subscriber welcome dismissal preserves profile siblings and survives server/session reload`,async()=>{
  const h=await schemaAdminRemotes(target,true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};}});
  try{
   const db=identityDb(h.database),now=new Date().toISOString();
   await db.insertInto('_cms_auth_profiles').values({user_id:'schema_subscriber',email:'subscriber@example.com',name:'Subscriber',avatar_url:null,email_verified:0,data:JSON.stringify({preference:'kept'}),created_at:now,updated_at:now}).execute();
   const response=await h.request('/api/welcome','subscriber',{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({action:'dismissWelcome'})});assert.equal(response.status,200);
   assert.deepEqual(JSON.parse((await db.selectFrom('_cms_auth_profiles').select('data').where('user_id','=','schema_subscriber').executeTakeFirstOrThrow()).data!),{preference:'kept',welcomeDismissed:true});
   await h.restart();const fresh=await h.request('/api/auth/me','subscriber');assert.equal(fresh.status,200);const body=await fresh.json();assert.equal(body.data.isFirstLogin,false);assert.equal(body.data.role,10);assert.equal(body.data.preference,undefined);
  }finally{await h.close();}
 });
 test(`${target}: welcome denial checks identity/origin before profile database access`,async()=>{
  const h=await schemaAdminRemotes(target,true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};}});
  try{
   h.probeStorage();let response=await h.request('/api/welcome',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:'{'});assert.equal(response.status,401);assert.equal(h.storageReads,0);
   response=await h.request('/api/welcome','subscriber',{method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},body:'{'});assert.equal(response.status,403);assert.equal(h.storageReads,0);
  }finally{await h.close();}
 });
}
