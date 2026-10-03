// Original native Kit review regressions, zero public API/MCP Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {persistedRemotes} from '../helpers/persisted-remotes.ts';

for(const field of ['constructor','prototype'])test(`registered ordinary list preserves indexed ${field} in a JSON query argument`,async()=>{
 const f=await persistedRemotes({persistedSessions:true,mutationsEnabled:true});
 try{
  const collection=await f.registry.getCollectionWithFields('post');assert.ok(collection);
  await f.registry.updateCollection('post',{supports:[]},{version:collection.version,updatedAt:collection.updatedAt});
  await f.registry.createField('post',{slug:field,label:field,type:'string',indexed:true});
  const wanted=await f.mutate('createContent',{collection:'post',data:JSON.stringify({title:'Wanted',[field]:'x'})});
  await f.mutate('createContent',{collection:'post',data:JSON.stringify({title:'Other',[field]:'y'})});
  const page=await f.query('listContent',{collection:'post',fieldFilters:JSON.parse(`{"${field}":"x"}`)});
  assert.equal(page.total,1);assert.deepEqual(page.items.map((item:any)=>item.id),[wanted._.result.id]);
 }finally{await f.close();}
});
