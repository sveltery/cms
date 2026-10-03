import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {ContentRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {RevisionRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {CmsError} from '../src/lib/server/database/contract.ts';
import {principal} from './helpers/lifecycle-fixture.ts';

// Original Node/D1 regressions. Exact-pin orchestration proof is the separate
// source reproducer; these declarations receive no copied-source parity credit.
const expected=(item:{version:number;updatedAt:string})=>({version:item.version,updatedAt:item.updatedAt});
async function fixture(target:'Node'|'D1') {
  const storage=await schemaAdminStorage(target);
  await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
  await registry.createCollection({slug:'post',label:'Posts'});
  await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const pending:Array<()=>void|Promise<void>>=[];
  const service=lifecycleService(storage.database,principal,{after:task=>pending.push(task)});
  const initial=await service.createContent({type:'post',slug:'live',data:{title:'Live'}});
  const key={type:'post',id:initial.id};await service.publish(key);
  const content=new ContentRepository(storage.database.db as any);
  const revisions=new RevisionRepository(storage.database.db as any);
  const flush=async()=>{for(const task of pending.splice(0))await task();};
  const count=async()=>Number((await sql<{n:number}>`SELECT COUNT(*) AS n FROM _cms_revisions WHERE entry_id=${initial.id}`.execute(storage.database.db)).rows[0].n);
  const queue=async()=>(await sql<{revision_id:string}>`SELECT revision_id FROM _cms_revision_prune_queue WHERE entry_id=${initial.id}`.execute(storage.database.db)).rows;
  return {storage,service,content,revisions,key,pending,flush,count,queue};
}
for(const target of ['Node','D1'] as const) {
  test(`${target}: invalid mixed publication date preserves the pinned partial draft commit`,async()=>{
    const f=await fixture(target);
    try {
      const before=(await f.content.findById('post',f.key.id))!;
      await assert.rejects(()=>f.service.updateContent({...f.key,expected:expected(before),data:{title:'Rejected draft'},publishedAt:'not-a-date'}),
        (cause:unknown)=>cause instanceof CmsError&&cause.code==='VALIDATION_ERROR');
      const after=(await f.content.findById('post',f.key.id))!;
      assert.equal(after.version,before.version+1);assert.notEqual(after.draftRevisionId,before.draftRevisionId);
      assert.equal((await f.revisions.findById(after.draftRevisionId!))?.data.title,'Rejected draft');
      assert.equal(after.data.title,'Live');assert.equal(after.publishedAt,before.publishedAt);
      await f.flush();
    } finally {await f.storage.close();}
  });
  test(`${target}: unpublish cycles drain actual queued history at the source retention cap`,async()=>{
    const f=await fixture(target);
    try {
      for(let cycle=0;cycle<55;cycle++) {
        const before=(await f.content.findById('post',f.key.id))!;
        const draft=await f.service.unpublish({...f.key,expected:expected(before)});
        assert.ok(draft.draftRevisionId);assert.ok(await f.revisions.findById(draft.draftRevisionId!));
        assert.equal(draft.liveRevisionId,null);
        await f.service.publish({...f.key,expected:expected(draft)});
        await f.flush();
      }
      assert.equal(await f.count(),50);
      assert.deepEqual(await f.queue(),[]);
      const current=(await f.content.findById('post',f.key.id))!;
      assert.ok(await f.revisions.findById(current.liveRevisionId!));
      assert.equal((await f.service.readPublished(f.key))?.data.title,'Live');
    } finally {await f.storage.close();}
  });
  test(`${target}: accepted ISO metadata SQL fault preserves the pinned mixed draft commit`,async()=>{
    const f=await fixture(target);
    try {
      await sql`CREATE TRIGGER review_metadata_fault BEFORE UPDATE OF published_at ON ec_post
        WHEN NEW.published_at='2020-01-01T00:00:00.000Z'
        BEGIN SELECT RAISE(ABORT,'review metadata fault'); END`.execute(f.storage.database.db);
      const before=(await f.content.findById('post',f.key.id))!;
      await assert.rejects(()=>f.service.updateContent({...f.key,expected:expected(before),data:{title:'Accepted REST draft'},publishedAt:'2020-01-01T00:00:00.000Z'}),/review metadata fault/);
      const after=(await f.content.findById('post',f.key.id))!;
      assert.equal(after.version,before.version+1);assert.notEqual(after.draftRevisionId,before.draftRevisionId);
      assert.equal((await f.revisions.findById(after.draftRevisionId!))?.data.title,'Accepted REST draft');
      assert.equal(after.data.title,'Live');assert.equal(after.publishedAt,before.publishedAt);
      await sql`DROP TRIGGER review_metadata_fault`.execute(f.storage.database.db);await f.flush();
    } finally {await f.storage.close();}
  });
  test(`${target}: unpublish pruning preserves a newer queued boundary and the current draft`,async()=>{
    const f=await fixture(target);
    try {
      for(let index=0;index<52;index++)await f.revisions.create({collection:'post',entryId:f.key.id,data:{title:`Old ${index}`}});
      const draft=await f.service.unpublish(f.key);
      const captured=(await f.queue())[0];assert.equal(captured.revision_id,draft.draftRevisionId);
      const newer=await f.revisions.create({collection:'post',entryId:f.key.id,data:{title:'Newer queued work'}});
      await f.flush();
      assert.equal((await f.queue())[0]?.revision_id,newer.id);
      assert.ok(await f.revisions.findById(draft.draftRevisionId!));
      assert.ok(await f.revisions.findById(newer.id));
      assert.equal(await f.count(),51,'fifty through captured boundary plus the newer row');
      // A successful idempotent unpublish also binds previously queued work.
      const repeated=await f.service.unpublish({...f.key,expected:expected(draft)});
      assert.equal(repeated.version,draft.version);assert.equal(repeated.draftRevisionId,draft.draftRevisionId);
      await f.flush();assert.equal(await f.count(),50);assert.deepEqual(await f.queue(),[]);
      // A stale request cannot add pruning work or change pointer/version.
      const pendingBefore=f.pending.length;
      await assert.rejects(()=>f.service.unpublish({...f.key,expected:{version:draft.version-1,updatedAt:draft.updatedAt}}),
        (cause:unknown)=>cause instanceof CmsError&&cause.code==='CONFLICT');
      assert.equal(f.pending.length,pendingBefore);
      const current=(await f.content.findById('post',f.key.id))!;assert.equal(current.version,draft.version);
      assert.equal(current.draftRevisionId,draft.draftRevisionId);
      assert.equal((await sql<{n:number}>`SELECT COUNT(*) AS n FROM ec_post WHERE id=${f.key.id}`.execute(f.storage.database.db)).rows[0]?.n,1);
    } finally {await f.storage.close();}
  });
}
