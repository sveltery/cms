import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
test('actual native taxonomy remotes persist definitions, hierarchy and assignments without changing the scalar token',async()=>{
 const h=await schemaAdminRemotes('Node');try{
  await h.registry.createCollection({slug:'posts',label:'Posts',supports:['drafts','revisions']});await h.registry.createField('posts',{slug:'title',label:'Title',type:'string'});
  const definition=(await h.mutate('createTaxonomyDefinition',{name:'topic',label:'Topics',labelSingular:'Topic','b:hierarchical':'on',collections:'["posts"]',locale:'en'}))._.result.taxonomy;assert.equal(definition.hierarchical,true);assert.deepEqual(definition.collections,['posts']);
  const parent=(await h.mutate('createTaxonomyTerm',{taxonomy:'topic',label:'Parent topic',locale:'en'}))._.result.term;
  const child=(await h.mutate('createTaxonomyTerm',{taxonomy:'topic',label:'Child topic',parentId:parent.id,locale:'en'}))._.result.term;
  assert.equal(child.parentId,parent.translationGroup);const tree=await h.query('listTaxonomyTerms',{taxonomy:'topic',locale:'en'});assert.equal(tree.terms[0].children[0].id,child.id);
  const entry=(await h.mutate('createLifecycleContent',{collection:'posts',data:'{"title":"Assigned entry"}'}))._.result;
  const key={collection:'posts',id:entry.id,locale:'en'};const before=await h.query('getLifecycleContent',key);
  await h.mutate('setEntryTaxonomyTerms',{...key,taxonomy:'topic',termIds:JSON.stringify([child.id])});
  const sidebar=await h.query('getEntryTaxonomies',key);assert.deepEqual(sidebar.find((group:any)=>group.definition.name==='topic').assignment.terms.map((term:any)=>term.id),[child.id]);assert.equal((await h.query('getLifecycleContent',key))._rev,before._rev);
  await h.mutate('setEntryTaxonomyTerms',{...key,taxonomy:'topic',termIds:'[]'});assert.deepEqual((await h.query('getEntryTaxonomies',key)).find((group:any)=>group.definition.name==='topic').assignment.terms,[]);
  await h.restart();assert.equal((await h.query('listTaxonomyTerms',{taxonomy:'topic',locale:'en'})).terms[0].children[0].id,child.id);
 }finally{await h.close();}
});
test('taxonomy management denies an author before inspecting storage',async()=>{const h=await schemaAdminRemotes('Node');try{h.probeStorage();const result=await h.remote('createTaxonomyDefinition','author',{name:'topic',label:'Topics',collections:'[]'});assert.equal(result.type,'error');assert.equal(result.status,403);assert.equal(h.storageReads,0);}finally{await h.close();}});
test('native taxonomy DELETE requires a current trusted manager and same origin',async()=>{const h=await schemaAdminRemotes('Node');try{const term=(await h.mutate('createTaxonomyTerm',{taxonomy:'category',label:'Delete me',locale:'en'}))._.result.term;const path=`/api/taxonomies/category/terms/${term.slug}`;assert.equal((await h.request(path,'admin',{method:'DELETE',headers:{origin:'https://untrusted.invalid'}})).status,403);assert.equal((await h.request(path,'author',{method:'DELETE',headers:{origin:h.origin}})).status,403);assert.equal((await h.request(path,'admin',{method:'DELETE',headers:{origin:h.origin}})).status,200);assert.equal((await h.query('listTaxonomyTerms',{taxonomy:'category',locale:'en'})).terms.length,0);}finally{await h.close();}});
