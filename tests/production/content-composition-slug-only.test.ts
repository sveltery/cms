// Original actual registered HTTP regressions with persisted principals and real
// Node/Worker D1 storage. Zero copied Source declaration or public API credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';

for(const target of ['Node','D1'] as const)for(const explicitData of [false,true])test(`${target}: registered ${explicitData?'explicit empty-data update stages its slug':'slug-only update preserves the live-metadata path'} across restart`,async()=>{
 const f=await schemaAdminRemotes(target);
 try{
  await f.registry.createCollection({slug:'post',label:'Posts'});await f.registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const created=await f.mutate('createContent',{collection:'post',slug:'original-live','data.title':'Published title'});
  const key={collection:'post',id:created._.result.id};let current=await f.query('getContent',key);
  await f.mutate('publishContent',{...key,_rev:current._rev});current=await f.query('getContent',key);
  const before=await f.database.db.selectFrom('ec_post').selectAll().where('id','=',key.id).executeTakeFirstOrThrow();
  const history=await f.database.db.selectFrom('_cms_revisions').selectAll().orderBy('id').execute();
  const result=await f.mutate('updateContent',{...key,_rev:current._rev,slug:'new-slug',...(explicitData?{data:'{}'}:{})});
  const saved=await f.query('getContent',key);
  assert.equal(saved.slug,explicitData?'original-live':'new-slug');
  assert.equal(saved.liveRevisionId,current.liveRevisionId);assert.notEqual(saved._rev,current._rev);
  assert.equal(result._.result._rev,saved._rev);assert.deepEqual(saved.data,{title:'Published title'});
  const after=await f.database.db.selectFrom('ec_post').selectAll().where('id','=',key.id).executeTakeFirstOrThrow();
  assert.equal(after.version,before.version+1);
  if(explicitData){
   assert.ok(saved.draftRevisionId);assert.deepEqual(saved.liveData,{title:'Published title'});
   const revision=await f.database.db.selectFrom('_cms_revisions').selectAll().where('id','=',saved.draftRevisionId).executeTakeFirstOrThrow();
   assert.equal(JSON.parse(revision.data)._slug,'new-slug');
  }else{
   assert.equal(saved.draftRevisionId,null);assert.equal(saved.liveData,undefined);
   assert.deepEqual(await f.database.db.selectFrom('_cms_revisions').selectAll().orderBy('id').execute(),history);
  }
  await f.restart();assert.deepEqual(await f.query('getContent',key),saved);
 }finally{await f.close();}
});
