import { afterEach,beforeEach,expect,it } from 'vitest';
import { sql,type Kysely } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../../src/lib/server/blocks/upstream/host.ts';
import { MediaUsageRepository } from '../../src/lib/server/blocks/upstream/database/repositories/media-usage.ts';
import { installMediaUsageCaptureTriggers } from '../../src/lib/server/blocks/upstream/media/usage/capture-triggers.ts';
import { CONTENT_SOURCE_SCHEMA_VERSION } from '../../src/lib/server/blocks/upstream/media/usage/types.ts';
import { processNativeDueMediaUsageWork,processNativeDueMediaUsageReconciliation,
  handleMediaUsageProgress,handleMediaUsageRepair } from '../../src/lib/server/media-usage/index.ts';
let owner:CmsDatabase,collectionId:string;
beforeEach(async()=>{
  owner=openSqlite(':memory:');await migrateCms(owner);registerBlockDatabaseHost(owner);
  const registry=new SchemaRegistry(owner);
  collectionId=(await registry.createCollection({slug:'post',label:'Posts'})).id;
  await registry.createField('post',{slug:'hero',label:'Hero',type:'image'});
  const db=owner.db as unknown as Kysely<Database>;
  await new MediaUsageRepository(db).upsertIndexStatus({adapterId:'content-media',scopeType:'collection',scopeKey:'post',
    status:'complete',schemaVersion:CONTENT_SOURCE_SCHEMA_VERSION,indexedSourceCount:0,failedSourceCount:0,
    skippedSourceCount:0,startedAt:null,completedAt:null,lastErrorCode:null});
  await owner.db.updateTable('_cms_media_usage_index_status' as never).set({collection_id:collectionId,
    capture_state:'installing',reconciliation_required:0} as never).execute();
  await installMediaUsageCaptureTriggers(db,{collectionId,collectionSlug:'post'});
  await owner.db.updateTable('_cms_media_usage_index_status' as never).set({capture_state:'active'} as never).execute();
  await owner.db.updateTable('_cms_media_usage_activation' as never).set({state:'active'} as never).execute();
});
afterEach(async()=>{await owner?.close();});
async function insertEntry(){
  await sql`INSERT INTO ec_post (id,slug,status,hero) VALUES ('entry-1','entry-1','published',${JSON.stringify({id:'controlled-asset',provider:'local'})})`.execute(owner.db);
}
it('consumes a real trigger-created entry version and stores the actual image projection',async()=>{
  await insertEntry();
  expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).toHaveLength(1);
  expect(await processNativeDueMediaUsageWork(owner)).toMatchObject({claimedCount:1,completedCount:1,retryCount:0,failedCount:0});
  expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).toEqual([]);
  expect(await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll().execute()).toEqual([
    expect.objectContaining({collection_id:collectionId,collection_slug:'post',content_id:'entry-1',source_variant:'columns',source_completeness:'complete'})]);
  expect(await owner.db.selectFrom('_cms_media_usage' as never).selectAll().execute()).toEqual([
    expect.objectContaining({field_slug:'hero',field_path:'hero',media_id:'controlled-asset',provider_asset_id:'controlled-asset'})]);
});
it('completes a real empty-collection reconciliation through scan, barriers and final coverage',async()=>{
  await owner.db.updateTable('_cms_media_usage_index_status' as never).set({reconciliation_required:1,status:'stale'} as never).execute();
  const outcomes:string[]=[];
  for(let tick=0;tick<12;tick++){
    // A controlled clock prerequisite, separate from immutable original clocks:
    // each real subsequent tick observes its actual stored checkpoint as due.
    await owner.db.updateTable('_cms_media_usage_reconciliations' as never).set({next_attempt_at:'2000-01-01T00:00:00.000Z'} as never).execute();
    outcomes.push((await processNativeDueMediaUsageReconciliation(owner)).outcome);
    if(outcomes.at(-1)==='completed')break;
  }
  expect(outcomes).toContain('completed');
  expect(await owner.db.selectFrom('_cms_media_usage_index_status' as never).selectAll().executeTakeFirstOrThrow())
    .toMatchObject({collection_id:collectionId,capture_state:'active',reconciliation_required:0,status:'complete'});
  expect(await handleMediaUsageProgress(owner)).toEqual({success:true,data:{status:'ready',readyCollections:1,totalCollections:1}});
});
it('repairs the actual image source and returns real repair counts through the full owned handler',async()=>{
  await insertEntry();
  expect(await handleMediaUsageRepair(owner,{scope:'collection',collection:'post'})).toMatchObject({success:true,data:{
    status:'complete',indexedSourceCount:1,failedSourceCount:0,deletedSourceCount:0,collections:[{collection:'post',status:'complete',indexedSourceCount:1}]}});
  expect(await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll().execute()).toHaveLength(1);
  expect(await owner.db.selectFrom('_cms_media_usage' as never).selectAll().execute()).toEqual([
    expect.objectContaining({media_id:'controlled-asset',provider_asset_id:'controlled-asset',field_slug:'hero'})]);
});
