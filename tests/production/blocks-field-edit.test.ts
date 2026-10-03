import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'devalue';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
import {BlockTypeRegistry} from '../../src/lib/server/blocks/registry.ts';
import {blocksDatabase} from '../../src/lib/server/blocks/host.ts';

// Original native transport regressions. Complete immutable blocks-field schema
// callbacks independently verify the retained/retired contract on both databases.
for(const target of ['Node','D1'] as const){
 test(`${target}: the actual HTML add-field form creates a stored blocks field`,async()=>{
  const h=await schemaAdminRemotes(target);try{
   await new BlockTypeRegistry(blocksDatabase(h.database)).createBlockType({slug:'hero',label:'Hero',fields:[]});
   await h.registry.createCollection({slug:'pages',label:'Pages'});
   const response=await h.request('/blocks');assert.equal(response.status,200);const html=await response.text();
   const forms=[...html.matchAll(/<form\b[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)];
   const form=forms.find(form=>form[1]!.includes(h.ids.get('addBlockSchemaField')!));assert.ok(form,'actual registered add-field HTML form');
   const hidden=form[2]!.match(/name="([^"]*expectedSchemaVersion)"/);assert.ok(hidden,'rendered schema-version input');
   const body=new URLSearchParams({collection:'pages',slug:'layout',label:'Layout','allowedTypes[]':'hero',minItems:'0',maxItems:'20',[hidden[1]!]: '1'});
   const action=new URL(form[1]!.replaceAll('&amp;','&'),`${h.origin}/blocks`);
   const saved=await h.request(`${action.pathname}${action.search}`,'admin',{method:'POST',headers:{origin:h.origin,accept:'text/html'},body});assert.equal(saved.status,200);
   const stored=await h.registry.getField('pages','layout');assert.ok(stored,'native HTML form must persist the field');
   assert.deepEqual(stored.validation,{allowedTypes:['hero'],retiredTypes:[],minItems:0,maxItems:20});
  }finally{await h.close();}
 });
 test(`${target}: native field editing submits ordered types, retires removals and survives reopen`,async()=>{
  const h=await schemaAdminRemotes(target);try{
   const blocks=new BlockTypeRegistry(blocksDatabase(h.database));
   for(const slug of ['hero','quote'])await blocks.createBlockType({slug,label:slug,fields:[]});
   await h.registry.createCollection({slug:'pages',label:'Pages'});
   await h.registry.createField('pages',{slug:'layout',label:'Layout',type:'blocks',validation:{allowedTypes:['hero','quote']}});
   assert.ok(h.ids.has('updateBlockSchemaField'),'registered block field editing transport');
   const edit=await h.mutate('updateBlockSchemaField',{collection:'pages',field:'layout',label:'Page layout','allowedTypes[]':'quote',maxItems:'20'});
   assert.equal(edit._.result.slug,'layout');
   const actual=await h.registry.getField('pages','layout');
   assert.equal(actual!.label,'Page layout');
   assert.deepEqual(actual!.validation,{allowedTypes:['quote'],retiredTypes:['hero'],minItems:0,maxItems:20});
   const body=new URLSearchParams([['collection','pages'],['field','layout'],['label','Page layout'],['allowedTypes[]','quote'],['allowedTypes[]','hero'],['maxItems','20']]);
   const response=await h.request(`/_app/remote/${h.ids.get('updateBlockSchemaField')}`,'admin',{method:'POST',headers:{origin:h.origin},body});
   assert.equal(response.status,200);const result=await response.json();assert.equal(result.type,'result');assert.equal(parse(result.data,h.decoders)._.issues,undefined);
   const reordered=await h.registry.getField('pages','layout');
   assert.deepEqual(reordered!.validation,{allowedTypes:['quote','hero'],retiredTypes:[],minItems:0,maxItems:20});
   await h.restart();assert.deepEqual(await h.registry.getField('pages','layout'),reordered);
  }finally{await h.close();}
 });
 test(`${target}: field editing is unavailable to unauthorized and disabled writers before storage`,async()=>{
  const h=await schemaAdminRemotes(target,false);try{
   assert.ok(h.ids.has('updateBlockSchemaField'),'registered block field editing transport');
   h.probeStorage();
   for(const [session,status,code] of [[null,401,'UNAUTHENTICATED'],['author',403,'INSUFFICIENT_PERMISSIONS'],['admin',503,'MUTATIONS_DISABLED']] as const){
    const result=await h.remote('updateBlockSchemaField',session,{collection:'pages',field:'layout',label:'Layout'});
    assert.equal(result.type,'error');assert.equal(result.status,status);assert.equal(result.error.code,code);
   }
   assert.equal(h.storageReads,0);
  }finally{await h.close();}
 });
}
