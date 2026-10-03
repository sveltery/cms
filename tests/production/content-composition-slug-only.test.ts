// Original actual registered HTTP regressions with persisted principals and real
// Node/Worker D1 storage. Zero copied Source declaration or public API credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';

for(const target of ['Node','D1'] as const)for(const explicitData of [false,true])test(`${target}: registered ${explicitData?'explicit empty-data update stages its slug':'slug-only update preserves the live-metadata path'} across restart`,async()=>{
 const f=await schemaAdminRemotes(target);
 try{
  await f.registry.createCollection({slug:'post',label:'Posts'});await f.registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const created=await f.mutate('createContent',{collection:'post',slug:'original-live','data.title':'Published title'});
  const key={collection:'post',id:created._.result.id};let current=await f.query('getContent',key);
  await f.mutate('publishContent',{...key,_rev:current._rev});current=await f.query('getContent',key);
  const before=(await sql<{version:number}>`SELECT * FROM ec_post WHERE id=${key.id}`.execute(f.database.db)).rows[0];
  const history=(await sql`SELECT * FROM _cms_revisions ORDER BY id`.execute(f.database.db)).rows;
  const result=await f.mutate('updateContent',{...key,_rev:current._rev,slug:'new-slug',...(explicitData?{data:'{}'}:{})});
  const saved=await f.query('getContent',key);
  assert.equal(saved.slug,explicitData?'original-live':'new-slug');
  assert.equal(saved.liveRevisionId,current.liveRevisionId);assert.notEqual(saved._rev,current._rev);
  assert.equal(result._.result._rev,saved._rev);assert.deepEqual(saved.data,{title:'Published title'});
  const after=(await sql<{version:number}>`SELECT * FROM ec_post WHERE id=${key.id}`.execute(f.database.db)).rows[0];
  assert.equal(after.version,before.version+1);
  if(explicitData){
   assert.ok(saved.draftRevisionId);assert.deepEqual(saved.liveData,{title:'Published title'});
   const revision=(await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE id=${saved.draftRevisionId}`.execute(f.database.db)).rows[0];
   assert.equal(JSON.parse(revision.data)._slug,'new-slug');
  }else{
   assert.equal(saved.draftRevisionId,null);assert.equal(saved.liveData,undefined);
   assert.deepEqual((await sql`SELECT * FROM _cms_revisions ORDER BY id`.execute(f.database.db)).rows,history);
  }
  await f.restart();assert.deepEqual(await f.query('getContent',key),saved);
 }finally{await f.close();}
});
