import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {ContentRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {RevisionRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {principal} from './helpers/lifecycle-fixture.ts';

// Original native host regressions, not copied source declarations. A throwing
// trusted scheduler must leave accepted writes and real queued work intact.
for(const target of ['Node','D1'] as const) {
  for(const operation of ['save','restore-draft','restore-plain','unpublish'] as const) {
    test(`${target}: ${operation} survives scheduler failure and queued work retries`,async()=>{
      const storage=await schemaAdminStorage(target);
      try {
        await migrateCms(storage.database);
        const registry=new SchemaRegistry(storage.database);
        await registry.createCollection({slug:'post',label:'Posts',...(operation==='restore-plain'?{supports:[]}:{})});
        await registry.createField('post',{slug:'title',label:'Title',type:'string'});
        const setup=lifecycleService(storage.database,principal,{after:()=>{}});
        const created=await setup.createContent({type:'post',slug:'live',data:{title:'Live'}});
        const key={type:'post',id:created.id};await setup.publish(key);
        const content=new ContentRepository(storage.database.db as any);
        const revisions=new RevisionRepository(storage.database.db as any);
        for(let index=0;index<51;index++)await revisions.create({collection:'post',entryId:created.id,data:{title:`Earlier ${index}`}});
        const historical=await revisions.create({collection:'post',entryId:created.id,data:{title:'Restored'}});
        const before=(await content.findById('post',created.id))!;
        const expected={version:before.version,updatedAt:before.updatedAt};
        const schedulerFault=new Error('native synchronous scheduler fault');let schedules=0;
        const service=lifecycleService(storage.database,principal,{after:()=>{schedules++;throw schedulerFault;}});
        let rejection:unknown;let receipt:unknown;
        try {
          if(operation==='save')receipt=await service.updateContent({...key,expected,data:{title:'Saved'}});
          else if(operation==='unpublish')receipt=await service.unpublish({...key,expected});
          else receipt=await service.restoreRevision({revisionId:historical.id,expected});
        } catch(cause){rejection=cause;}
        const accepted=(await content.findById('post',created.id))!;
        const queue=(await sql<{revision_id:string}>`SELECT revision_id FROM _cms_revision_prune_queue WHERE entry_id=${created.id}`.execute(storage.database.db)).rows;
        assert.equal(schedules,1);assert.equal(accepted.version,before.version+1);
        assert.equal(queue.length,1,'the committed revision remains queued after scheduler refusal');
        const title=operation==='save'?'Saved':operation==='unpublish'?'Live':'Restored';
        if(operation==='restore-plain')assert.equal(accepted.data.title,title);
        else {
          assert.ok(accepted.draftRevisionId);assert.equal(queue[0].revision_id,accepted.draftRevisionId);
          assert.equal((await revisions.findById(accepted.draftRevisionId!))?.data.title,title);
        }
        assert.equal(rejection,undefined,'synchronous maintenance scheduling cannot reject the committed mutation');
        assert.ok(receipt,'the caller receives the accepted mutation receipt');
        const pending:Array<()=>void|Promise<void>>=[];
        const retry=lifecycleService(storage.database,principal,{after:task=>pending.push(task)});
        const draft=await retry.unpublish({...key,expected:{version:accepted.version,updatedAt:accepted.updatedAt}});
        assert.equal(pending.length,1,'a later real operation binds queued work again');
        for(const task of pending)await task();
        assert.equal(Number((await sql<{n:number}>`SELECT COUNT(*) AS n FROM _cms_revisions WHERE entry_id=${created.id}`.execute(storage.database.db)).rows[0].n),50);
        assert.deepEqual((await sql`SELECT revision_id FROM _cms_revision_prune_queue WHERE entry_id=${created.id}`.execute(storage.database.db)).rows,[]);
        assert.ok(await revisions.findById(draft.draftRevisionId!));
        assert.equal((await retry.getContent(key)).data.title,title);
      } finally {await storage.close();}
    });
  }
}
