import assert from 'node:assert/strict';
import { test } from 'vitest';
import { sql } from 'kysely';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { historicalFeatureStorage } from '../helpers/canonical-feature-storage-original.ts';
import { databaseSnapshot } from '../helpers/lifecycle-startup.ts';
import { principal } from '../helpers/lifecycle-fixture.ts';

for(const mode of ['Node','raw D1','scoped D1'] as const){
  test(mode+': sole lifecycle create commits SEO and returns the stored shape',async()=>{
    const fixture=await historicalFeatureStorage(mode);
    try{
      await migrateCms(fixture.database);
      await new SchemaRegistry(fixture.database).createCollection({slug:'post',label:'Posts',supports:['seo','drafts']});
      const service=lifecycleService(fixture.database,principal,{after:()=>{}});
      let created:any;
      await assert.doesNotReject(async()=>{created=await service.createContent({type:'post',data:{},seo:{title:'Stored title',canonical:'https://example.com/original'}});});
      assert.equal(created.seo.title,'Stored title');
      const row=(await sql<{seo_title:string}>`SELECT seo_title FROM _cms_seo WHERE collection='post' AND content_id=${created.id}`.execute(fixture.database.db)).rows[0];
      assert.equal(row.seo_title,'Stored title');
    }finally{await fixture.close();}
  },90000);

  test(mode+': ordinary and staged draft updates preserve metadata, history and stale CAS',async()=>{
    const fixture=await historicalFeatureStorage(mode);
    try{
      await migrateCms(fixture.database);
      const registry=new SchemaRegistry(fixture.database);
      await registry.createCollection({slug:'post',label:'Posts',supports:['seo','drafts','revisions']});
      await registry.createField('post',{slug:'title',label:'Title',type:'string'});
      const service=lifecycleService(fixture.database,principal,{after:()=>{}});
      const created=await service.createContent({type:'post',data:{title:'Live'}});
      let metadata:any;
      await assert.doesNotReject(async()=>{metadata=await service.updateContent({type:'post',id:created.id,expected:{version:created.version,updatedAt:created.updatedAt},seo:{title:'Metadata'}});});
      assert.equal(metadata.item.seo.title,'Metadata');
      const staged=await service.updateContent({type:'post',id:created.id,expected:{version:metadata.item.version,updatedAt:metadata.item.updatedAt},data:{title:'Draft'},seo:{title:'Staged metadata',description:'Description'}});
      assert.equal(staged.item.data.title,'Draft');
      assert.equal(staged.item.seo?.title,'Staged metadata');
      const base=(await sql<{title:string;draft_revision_id:string}>`SELECT title,draft_revision_id FROM ec_post WHERE id=${created.id}`.execute(fixture.database.db)).rows[0];
      assert.equal(base.title,'Live');
      assert.ok(base.draft_revision_id);
      const history=(await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE entry_id=${created.id}`.execute(fixture.database.db)).rows;
      assert.ok(history.some(row=>JSON.parse(row.data).title==='Draft'));
      const before=await databaseSnapshot(fixture.database);
      await assert.rejects(()=>service.updateContent({type:'post',id:created.id,expected:{version:created.version,updatedAt:created.updatedAt},seo:{title:'Stale'}}),{code:'CONFLICT'});
      assert.deepEqual(await databaseSnapshot(fixture.database),before);
    }finally{await fixture.close();}
  },90000);

  test(mode+': actual SEO write fault rolls back the content create batch',async()=>{
    const fixture=await historicalFeatureStorage(mode);
    try{
      await migrateCms(fixture.database);
      await new SchemaRegistry(fixture.database).createCollection({slug:'post',label:'Posts',supports:['seo','drafts']});
      const before=await databaseSnapshot(fixture.database);
      let seoWasPlanned=false;
      const subject={...fixture.database,async atomicBatch(statements:any){
        seoWasPlanned=statements.some((statement:any)=>statement.sql.includes('_cms_seo'));
        return fixture.database.atomicBatch([...statements,sql`SELECT json_extract('[]','seo-content-create-rollback')`.compile(fixture.database.db)]);
      }};
      await assert.rejects(()=>lifecycleService(subject,principal,{after:()=>{}}).createContent({type:'post',data:{},seo:{title:'Must roll back'}}));
      assert.equal(seoWasPlanned,true);
      assert.deepEqual(await databaseSnapshot(fixture.database),before);
    }finally{await fixture.close();}
  },90000);
}
