// Original registered native form requirements. HTML blank controls represent
// JSON null; domain JSON strings retain their own meaning. Zero Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';

for(const target of ['Node','D1'] as const)for(const explicitData of [false,true])test(`${target}: blank native slug ${explicitData?'stages null':'clears live metadata'} on two entries and survives restart`,async()=>{
 const f=await schemaAdminRemotes(target);
 try{
  await f.registry.createCollection({slug:'post',label:'Posts',routable:false,urlPattern:null});await f.registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const savedEntries=[];
  for(const suffix of ['first','second']){
   const created=await f.mutate('createContent',{collection:'post',slug:`original-${suffix}`,'data.title':`Title ${suffix}`});
   const key={collection:'post',id:created._.result.id};let current=await f.query('getContent',key);
   await f.mutate('publishContent',{...key,_rev:current._rev});current=await f.query('getContent',key);
   const history=(await sql`SELECT * FROM _cms_revisions WHERE entry_id=${key.id} ORDER BY id`.execute(f.database.db)).rows;
   const result=await f.mutate('updateContent',{...key,_rev:current._rev,slug:'',...(explicitData?{data:'{}'}:{})});
   const saved=await f.query('getContent',key);
   assert.equal(saved.liveRevisionId,current.liveRevisionId);assert.notEqual(saved._rev,current._rev);
   assert.equal(result._.result._rev,saved._rev);assert.deepEqual(saved.data,{title:`Title ${suffix}`});
   if(explicitData){
    assert.equal(saved.slug,`original-${suffix}`);assert.ok(saved.draftRevisionId);
    const revision=(await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE id=${saved.draftRevisionId}`.execute(f.database.db)).rows[0];
    assert.equal(JSON.parse(revision.data)._slug,null);
    assert.deepEqual(saved.liveData,{title:`Title ${suffix}`});
   }else{
    assert.equal(saved.slug,null);assert.equal(saved.draftRevisionId,null);assert.equal(saved.liveData,undefined);
    assert.deepEqual((await sql`SELECT * FROM _cms_revisions WHERE entry_id=${key.id} ORDER BY id`.execute(f.database.db)).rows,history);
   }
   savedEntries.push({key,saved});
  }
  if(!explicitData)assert.equal((await sql<{n:number}>`SELECT COUNT(*) AS n FROM ec_post WHERE slug IS NULL`.execute(f.database.db)).rows[0].n,2);
  await f.restart();for(const {key,saved} of savedEntries)assert.deepEqual(await f.query('getContent',key),saved);
 }finally{await f.close();}
});
