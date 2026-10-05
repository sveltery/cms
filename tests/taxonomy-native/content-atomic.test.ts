// Supplemental actual Native Node/D1 atomicity checks. These add no Source
// matcher credit, HTTP/auth probes or synthetic transaction/result providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import type {RawBuilder} from 'kysely';
import {schemaAdminStorage} from '../helpers/schema-admin-storage.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {canonicalSourceDatabase} from '../../src/lib/server/canonical-storage/namespace.ts';
import {TaxonomyRepository} from '../../src/lib/server/taxonomies/repository.ts';

async function fixture(target:'Node'|'D1') {
 const storage=await schemaAdminStorage(target);
 await migrateCms(storage.database);
 const registry=new SchemaRegistry(storage.database);
 await registry.createCollection({slug:'post',label:'Posts'});
 await registry.createField('post',{slug:'title',label:'Title',type:'string'});
 const service=lifecycleService(storage.database,principal,{after:()=>{}});
 const taxonomy=new TaxonomyRepository(canonicalSourceDatabase(storage.database));
 const first=await taxonomy.create({name:'tag',slug:'first',label:'First'});
 const second=await taxonomy.create({name:'tag',slug:'second',label:'Second'});
 const rows=async<Row>(query:RawBuilder<Row>)=>(await query.execute(storage.database.db)).rows;
 const guards=()=>rows(sql`SELECT token FROM _cms_guards`);
 const content=()=>rows(sql<{title:string|null;draft_revision_id:string|null}>`SELECT * FROM ec_post ORDER BY id`);
 const revisions=()=>rows(sql<{id:string;data:string}>`SELECT * FROM _cms_revisions ORDER BY id`);
 const assignments=()=>rows(sql`SELECT * FROM _cms_content_taxonomies ORDER BY collection,entry_id,taxonomy_id`);
 const queue=()=>rows(sql`SELECT * FROM _cms_revision_prune_queue ORDER BY collection,entry_id`);
 const snapshot=async()=>({content:await content(),revisions:await revisions(),assignments:await assignments(),queue:await queue(),guards:await guards()});
 return {storage,service,taxonomy,first,second,rows,guards,content,revisions,assignments,snapshot};
}

for(const target of ['Node','D1'] as const) {
 test(`${target}: taxonomy assignments and genuine draft revision stage commit together`,async()=>{
  const f=await fixture(target);
  try {
   const created=await f.service.createContent({type:'post',slug:'article',data:{title:'Live'},taxonomies:{tag:['first']}});
   const published=await f.service.publish({type:'post',id:created.id});
   const updated=(await f.service.updateContent({type:'post',id:created.id,
    expected:{version:published.version,updatedAt:published.updatedAt},data:{title:'Draft'},taxonomies:{tag:['second']}})).item;
   assert.equal(updated.data.title,'Draft');assert.equal(updated.liveData?.title,'Live');
   assert.equal(updated.liveRevisionId,published.liveRevisionId);assert.ok(updated.draftRevisionId);
   assert.equal(updated.version,published.version+1);
   const stored=(await f.content())[0];assert.equal(stored.title,'Live');assert.equal(stored.draft_revision_id,updated.draftRevisionId);
   const revision=(await f.revisions()).find(row=>row.id===updated.draftRevisionId);
   assert.ok(revision);assert.equal(JSON.parse(String(revision.data)).title,'Draft');
   assert.deepEqual((await f.taxonomy.getTermsForEntry('post',created.id,'tag')).map(term=>term.id),[f.second.id]);
   assert.deepEqual(await f.guards(),[]);
  } finally {await f.storage.close();}
 });

 test(`${target}: assignment insertion failure rolls back the actual content INSERT`,async()=>{
  const f=await fixture(target);
  try {
   const before=await f.snapshot();
   await f.rows(sql`CREATE TRIGGER taxonomy_content_insert_failure BEFORE INSERT ON _cms_content_taxonomies
    WHEN NEW.taxonomy_id=${sql.lit(f.second.id)} BEGIN SELECT RAISE(ABORT,'taxonomy content assignment failure'); END`);
   await assert.rejects(()=>f.service.createContent({type:'post',slug:'rejected',data:{title:'Rejected'},taxonomies:{tag:['second']}}),/taxonomy content assignment failure/);
   assert.deepEqual(await f.snapshot(),before);
  } finally {await f.storage.close();}
 });

 test(`${target}: assignment insertion failure rolls back revision INSERT, stage and old pivots`,async()=>{
  const f=await fixture(target);
  try {
   const created=await f.service.createContent({type:'post',slug:'article',data:{title:'Original'},taxonomies:{tag:['first']}});
   const before=await f.snapshot();
   await f.rows(sql`CREATE TRIGGER taxonomy_revision_assignment_failure BEFORE INSERT ON _cms_content_taxonomies
    WHEN NEW.taxonomy_id=${sql.lit(f.second.id)} BEGIN SELECT RAISE(ABORT,'taxonomy revision assignment failure'); END`);
   await assert.rejects(()=>f.service.updateContent({type:'post',id:created.id,
    expected:{version:created.version,updatedAt:created.updatedAt},data:{title:'Rejected'},taxonomies:{tag:['second']}}),/taxonomy revision assignment failure/);
   assert.deepEqual(await f.snapshot(),before);
  } finally {await f.storage.close();}
 });

 test(`${target}: zero-row revision stage cannot commit a revision or new assignments`,async()=>{
  const f=await fixture(target);
  try {
   const created=await f.service.createContent({type:'post',slug:'article',data:{title:'Original'},taxonomies:{tag:['first']}});
   const before=await f.snapshot();
   await f.rows(sql`CREATE TRIGGER taxonomy_revision_stage_refusal BEFORE UPDATE OF draft_revision_id ON ec_post
    WHEN NEW.draft_revision_id IS NOT OLD.draft_revision_id BEGIN SELECT RAISE(IGNORE); END`);
   await assert.rejects(()=>f.service.updateContent({type:'post',id:created.id,
    expected:{version:created.version,updatedAt:created.updatedAt},data:{title:'Rejected'},taxonomies:{tag:['second']}}),
    (cause:unknown)=>cause instanceof Error&&'code' in cause&&cause.code==='CONFLICT');
   assert.deepEqual(await f.snapshot(),before);
  } finally {await f.storage.close();}
 });
}
