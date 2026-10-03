import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {ContentRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {principal} from './helpers/lifecycle-fixture.ts';

// Original native regressions. Complete pinned public-route evidence is in the
// separate source diagnostic; these declarations earn zero source credit.
for(const target of ['Node','D1'] as const) {
  test(`${target}: staged slug collision preserves its public code and both complete entries`,async()=>{
    const storage=await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
      await registry.createCollection({slug:'post',label:'Posts'});
      await registry.createField('post',{slug:'title',label:'Title',type:'string'});
      const pending:Array<()=>void|Promise<void>>=[];
      const service=lifecycleService(storage.database,principal,{after:task=>pending.push(task)});
      const first=await service.createContent({type:'post',slug:'original',data:{title:'Live'}});
      const occupied=await service.createContent({type:'post',slug:'occupied',data:{title:'Occupied'}});
      const key={type:'post',id:first.id};await service.publish(key);await service.publish({type:'post',id:occupied.id});
      await service.updateContent({...key,data:{title:'Pending draft'},slug:'occupied'});
      for(const task of pending.splice(0))await task();
      const content=new ContentRepository(storage.database.db as any);
      const before=await content.findById('post',first.id);const other=await content.findById('post',occupied.id);
      const history=await sql`SELECT * FROM _cms_revisions WHERE entry_id=${first.id} ORDER BY id`.execute(storage.database.db);
      let failure:unknown;
      try {await service.publish({...key,expected:{version:before!.version,updatedAt:before!.updatedAt}});}catch(cause){failure=cause;}
      assert.deepEqual(await content.findById('post',first.id),before);
      assert.deepEqual(await content.findById('post',occupied.id),other);
      assert.deepEqual((await sql`SELECT * FROM _cms_revisions WHERE entry_id=${first.id} ORDER BY id`.execute(storage.database.db)).rows,history.rows);
      assert.ok(failure instanceof Error);
      assert.equal(failure.message,`Cannot publish: slug 'occupied' is already used by another entry in this collection (id: ${occupied.id}). Choose a different slug.`);
      assert.equal((failure as Error&{code?:string}).code,'SLUG_CONFLICT');
      assert.equal(pending.length,0,'a rejected publication schedules no maintenance');
    } finally {await storage.close();}
  });
}
