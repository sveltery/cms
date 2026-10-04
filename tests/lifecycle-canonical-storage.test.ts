import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {installVersion4,legacyPost} from './helpers/lifecycle-startup.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {DraftRepository} from '../src/lib/server/database/entries.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {sql} from 'kysely';
import type {ServerPrincipal} from '../src/lib/server/database/service.ts';

// Original integration requirements: zero copied source declaration credit.
// Real canonical startup and real services on both adapter implementations.
const actor:ServerPrincipal={id:'author-1',permissions:['content:create','content:read','content:read_drafts','content:edit_own','content:publish_own']};
const expected=(item:{version:number;updatedAt:string})=>({version:item.version,updatedAt:item.updatedAt});
for(const target of ['Node','D1'] as const)for(const layout of ['fresh','v4'] as const) {
  test(`${target}: ${layout} canonical startup publishes, stages, rolls back and retains history on reopen`,{timeout:90_000},async()=>{
    const directory=await mkdtemp(join(tmpdir(),'cms-lifecycle-canonical-'));
    let storage=await schemaAdminStorage(target,directory);
    const deferred:Array<()=>void|Promise<void>>=[];
    try {
      let legacyId:string|undefined;
      if(layout==='v4') {
        await installVersion4(storage.database);await legacyPost(storage.database);
        legacyId=(await new DraftRepository(storage.database).create({type:'post',slug:'canonical',data:{title:'Live original'}},actor.id)).id;
      }
      await migrateCms(storage.database);
      if(layout==='fresh') {
        const registry=new SchemaRegistry(storage.database);
        await registry.createCollection({slug:'post',label:'Posts'});
        await registry.createField('post',{slug:'title',label:'Title',type:'string'});
      }
      const service=lifecycleService(storage.database,actor,{after:task=>deferred.push(task)});
      const initial=legacyId?await service.getContent({type:'post',id:legacyId}):await service.createContent({type:'post',slug:'canonical',data:{title:'Live original'}});
      const key={type:'post',id:initial.id};
      const published=await service.publish({...key,expected:expected(initial)});
      assert.equal(published.status,'published');assert.ok(published.liveRevisionId);
      await service.createContent({type:'post',slug:'occupied',data:{title:'Another row'}});
      const staged=(await service.updateContent({...key,expected:expected(published),data:{title:'Staged changes'},slug:'occupied'})).item;
      assert.equal(staged.liveData?.title,'Live original');assert.equal(staged.updatedAt,published.updatedAt);
      assert.equal((await service.readPublished(key))?.data.title,'Live original');
      const history=await service.listRevisions(key);
      assert.ok(history.some(row=>row.id===published.liveRevisionId));assert.ok(history.some(row=>row.id===staged.draftRevisionId));
      await assert.rejects(()=>service.publish({...key,expected:expected(staged)}));
      assert.deepEqual(await service.getContent(key),staged);
      assert.equal((await service.readPublished(key))?.data.title,'Live original');
      const discarded=await service.discardDraft({...key,expected:expected(staged)});
      assert.equal(discarded.draftRevisionId,null);assert.equal(discarded.updatedAt,published.updatedAt);
      const restored=await service.restoreRevision({...key,revisionId:published.liveRevisionId!,expected:expected(discarded)});
      assert.ok(restored.draftRevisionId);assert.equal(restored.updatedAt,published.updatedAt);
      const republished=await service.publish({...key,expected:expected(restored)});
      assert.equal(republished.status,'published');assert.equal(republished.draftRevisionId,null);
      for(const task of deferred.splice(0))await task();
      const before=await service.listRevisions(key);
      const markers=(await sql<{version:number}>`SELECT version FROM _cms_migrations ORDER BY version`.execute(storage.database.db)).rows.map(row=>row.version);
      assert.deepEqual(markers.slice(0,5),[1,2,3,4,5]);
      assert.deepEqual(markers.slice(0,8),[1,2,3,4,5,6,7,8]);
      assert.deepEqual(markers,[1,2,3,4,5,6,7,8,9,10,11,12,13,14]);
      await storage.close();storage=await schemaAdminStorage(target,directory);
      await migrateCms(storage.database);
      const reopened=lifecycleService(storage.database,actor);
      assert.deepEqual(await reopened.getContent(key),republished);
      assert.deepEqual(await reopened.listRevisions(key),before);
    } finally {await storage.close();await rm(directory,{recursive:true,force:true});}
  });
}
