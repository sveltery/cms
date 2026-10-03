import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
for(const target of ['Node','D1'] as const){
 test(`${target}: native block API authenticates and authorizes before body parsing`,async()=>{
  const h=await schemaAdminRemotes(target);try{
   for(const [session,status]of [[null,401],['subscriber',403]] as const){
    const result=await h.request('/_emdash/api/schema/block-types',session,{method:'POST',headers:{origin:h.origin},body:'invalid JSON'});
    assert.equal(result.status,status);
   }
   assert.equal((await h.request('/_emdash/api/schema/block-types','admin',{method:'POST',headers:{origin:'https://foreign.example'},body:'invalid JSON'})).status,403);
  }finally{await h.close();}
 });
 test(`${target}: block definitions version and activate through real stored HTTP requests`,async()=>{
  const h=await schemaAdminRemotes(target);try{
   const create=await h.request('/_emdash/api/schema/block-types','admin',{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({slug:'hero',label:'Hero',fields:[{slug:'heading',label:'Heading',type:'string',required:true}]})});
   assert.equal(create.status,201);const original=(await create.json()).data.item;
   const update=await h.request('/_emdash/api/schema/block-types/hero','admin',{method:'PUT',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({expectedFingerprint:original.versions[0].fingerprint,breaking:true,fields:[{slug:'title',label:'Title',type:'string',required:true}]})});
   assert.equal(update.status,200);assert.equal((await update.json()).data.item.currentVersion,1);
   const activation=await h.request('/_emdash/api/schema/block-types/hero/versions/2/activate','admin',{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({expectedFingerprint:original.versions[0].fingerprint})});
   assert.equal(activation.status,200);assert.equal((await activation.json()).data.item.currentVersion,2);
   assert.equal((await h.request('/_emdash/api/schema/block-types/hero','admin',{method:'DELETE',headers:{origin:h.origin}})).status,405);
   await h.restart();
   const read=await h.request('/_emdash/api/schema/block-types/hero');assert.equal(read.status,200);assert.equal((await read.json()).data.item.versions.length,2);
  }finally{await h.close();}
 });
 test(`${target}: block administration exposes usable definition and field controls`,async()=>{
  const h=await schemaAdminRemotes(target);try{
   const page=await h.request('/blocks');assert.equal(page.status,200);const html=await page.text();
   assert.match(html,/>Block types</);assert.match(html,/Create block type/);assert.match(html,/Block field slug/);
  }finally{await h.close();}
 });
}
