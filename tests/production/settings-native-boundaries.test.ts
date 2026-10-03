// Supplemental native settings transport checks; zero source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'devalue';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
for(const target of ['Node','D1'] as const){
 test(`${target}: settings JSON mutations reject foreign origins before writes`,async()=>{
  const h=await schemaAdminRemotes(target);
  try{
   const response=await h.request('/api/settings','admin',{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:JSON.stringify({title:'Foreign'})});
   assert.equal(response.status,403);
   assert.deepEqual(await h.query('getSiteSettings'),{});
  }finally{await h.close();}
 });
 test(`${target}: anonymous and insufficient settings permissions deny before storage`,async()=>{
  const h=await schemaAdminRemotes(target);
  try{
   h.probeStorage('throw');
   for(const [session,status]of [[null,401],['subscriber',403]] as const){
    const get=await h.request('/api/settings',session);assert.equal(get.status,status);
    const post=await h.request('/api/settings',session,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:'invalid'});assert.equal(post.status,status);
   }
   assert.equal(h.storageReads,0);
  }finally{await h.close();}
 });
 test(`${target}: registered site form strips framework transport and refreshes persistent data`,async()=>{
  const h=await schemaAdminRemotes(target);
  try{
   const envelope=await h.remote('updateSiteSettings','admin',{title:'Saved title',tagline:'Saved tagline','social.twitter':'@native'});
   assert.equal(envelope.type,'result');const value=parse(envelope.data)._;assert.equal(value.issues,undefined);assert.deepEqual(value.result,{saved:true});
   await h.restart();assert.deepEqual(await h.query('getSiteSettings'),{title:'Saved title',tagline:'Saved tagline',social:{twitter:'@native'}});
  }finally{await h.close();}
 });
}
