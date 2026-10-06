import { afterEach,beforeEach,expect,it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { MediaUsageRepository } from '../../src/lib/server/blocks/upstream/database/repositories/media-usage.ts';
import { CONTENT_SOURCE_SCHEMA_VERSION } from '../../src/lib/server/blocks/upstream/media/usage/types.ts';
import { handleMediaUsageProgress,handleMediaUsageProgressAdvance,handleMediaUsageWorkList,
  handleMediaUsageWorkRetry,handleMediaUsageCollectionDeletionList,handleMediaUsageCollectionDeletionRetry } from '../../src/lib/server/media-usage/index.ts';
let owner:CmsDatabase,collectionId:string;
beforeEach(async()=>{
  owner=openSqlite(':memory:');await migrateCms(owner);
  collectionId=(await new SchemaRegistry(owner).createCollection({slug:'post',label:'Posts'})).id;
  await new MediaUsageRepository(owner.db as unknown as Kysely<Database>).upsertIndexStatus({
    adapterId:'content-media',scopeType:'collection',scopeKey:'post',status:'complete',
    schemaVersion:CONTENT_SOURCE_SCHEMA_VERSION,indexedSourceCount:0,failedSourceCount:0,
    skippedSourceCount:0,startedAt:null,completedAt:null,lastErrorCode:null});
  await owner.db.updateTable('_cms_media_usage_index_status' as never).set({collection_id:collectionId,
    capture_state:'active',reconciliation_required:0} as never).execute();
  await owner.db.updateTable('_cms_media_usage_activation' as never).set({state:'active'} as never).execute();
});
afterEach(async()=>{await owner?.close();});
it('returns genuine canonical ready counts and an idle continuation after a real complete step',async()=>{
  expect(await handleMediaUsageProgress(owner)).toEqual({success:true,data:{status:'ready',readyCollections:1,totalCollections:1}});
  expect(await handleMediaUsageProgressAdvance(owner)).toMatchObject({success:true,data:{
    activation:{state:'active'},progress:{status:'ready',readyCollections:1,totalCollections:1},nextRequestInMs:null}});
});
it('preserves the actual canonical activation class identity in both mismatch errors',async()=>{
  await owner.db.updateTable('_cms_media_usage_activation' as never).set({runtime_generation:99} as never).execute();
  expect(await handleMediaUsageProgress(owner)).toMatchObject({success:false,error:{code:'MEDIA_USAGE_ACTIVATION_VERSION_MISMATCH'}});
  expect(await handleMediaUsageProgressAdvance(owner)).toMatchObject({success:false,error:{code:'MEDIA_USAGE_ACTIVATION_VERSION_MISMATCH'}});
});
it('returns the real live activation lease delay without advancing the stored cursor',async()=>{
  await owner.db.updateTable('_cms_media_usage_activation' as never).set({state:'activating',
    drain_confirmed_at:'2026-08-24T00:00:00.000Z',lease_token:'controlled-other-owner',
    lease_expires_at:'2999-01-01T00:00:00.000Z',collection_cursor:null} as never).execute();
  expect(await handleMediaUsageProgressAdvance(owner)).toMatchObject({success:true,data:{
    activation:{state:'activating',collectionCursor:null,leaseExpiresAt:'2999-01-01T00:00:00.000Z'},
    progress:null,nextRequestInMs:30_000}});
});
it('reports and retries actual failed work with redacted operator records and stored-state effects',async()=>{
  await owner.db.insertInto('_cms_media_usage_work' as never).values({collection_id:collectionId,collection_slug:'post',
    content_id:'entry-1',change_epoch:1,work_version:7,state:'failed',attempt_count:5,
    next_attempt_at:'2000-01-01T00:00:00.000Z',lease_token:'controlled-private-token'} as never).execute();
  expect(await handleMediaUsageProgress(owner)).toMatchObject({success:true,data:{status:'needs_attention',readyCollections:0,totalCollections:1}});
  const listed=await handleMediaUsageWorkList(owner,{collection:'post',state:'failed',limit:1});
  expect(listed).toMatchObject({success:true,data:{items:[{collectionId,contentId:'entry-1',state:'failed',attemptCount:5}]}});
  expect(JSON.stringify(listed)).not.toContain('controlled-private-token');
  expect(await handleMediaUsageWorkRetry(owner,{collectionId,contentId:'entry-1'})).toMatchObject({success:true,data:{changed:true,item:{state:'pending',attemptCount:0}}});
  expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().executeTakeFirstOrThrow()).toMatchObject({state:'pending',lease_token:null,attempt_count:0});
});
it('lists and retries the real failed collection-deletion checkpoint',async()=>{
  await owner.db.insertInto('_cms_media_usage_collection_deletions' as never).values({collection_id:'deleted-id',
    collection_slug:'deleted_post',force_delete:1,phase:'work',state:'failed',attempt_count:5,
    next_attempt_at:'2000-01-01T00:00:00.000Z'} as never).execute();
  expect(await handleMediaUsageCollectionDeletionList(owner,{state:'failed',limit:1})).toMatchObject({success:true,data:{items:[{collectionId:'deleted-id',phase:'work',state:'failed'}]}});
  expect(await handleMediaUsageCollectionDeletionRetry(owner,{collectionId:'deleted-id'})).toMatchObject({success:true,data:{changed:true,item:{phase:'work',state:'pending',attemptCount:0}}});
  expect(await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow()).toMatchObject({phase:'work',state:'pending',attempt_count:0});
});
