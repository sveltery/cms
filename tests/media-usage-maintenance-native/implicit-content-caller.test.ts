import { afterEach,beforeEach,expect,it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { Kysely } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { nativeContentRuntime } from '../../src/lib/server/database/content-runtime.ts';
import type { ServerPrincipal } from '../../src/lib/server/database/service.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../../src/lib/server/blocks/upstream/host.ts';
import { MediaUsageRepository } from '../../src/lib/server/blocks/upstream/database/repositories/media-usage.ts';
import { installMediaUsageCaptureTriggers } from '../../src/lib/server/blocks/upstream/media/usage/capture-triggers.ts';
import { CONTENT_SOURCE_SCHEMA_VERSION } from '../../src/lib/server/blocks/upstream/media/usage/types.ts';
import { buildContentMediaUsageSourceKey } from '../../src/lib/server/blocks/upstream/media/usage/source-key.ts';
import { refreshNativeContentUsageAfterSuccessfulWrite } from '../../src/lib/server/media-usage/index.ts';
let owner:CmsDatabase,collectionId:string;
const principal:ServerPrincipal={id:'maintenance-runtime-fixture',permissions:[
  'content:create','content:read','content:read_drafts','content:edit_any','content:publish_any']};
beforeEach(async()=>{
  owner=openSqlite(':memory:');await migrateCms(owner);registerBlockDatabaseHost(owner);
  const registry=new SchemaRegistry(owner);
  collectionId=(await registry.createCollection({slug:'fast_posts',label:'Posts'})).id;
  await registry.createField('fast_posts',{slug:'title',label:'Title',type:'string'});
  const db=owner.db as unknown as Kysely<Database>;
  await new MediaUsageRepository(db).upsertIndexStatus({adapterId:'content-media',scopeType:'collection',scopeKey:'fast_posts',
    status:'complete',schemaVersion:CONTENT_SOURCE_SCHEMA_VERSION,indexedSourceCount:0,failedSourceCount:0,
    skippedSourceCount:0,startedAt:null,completedAt:null,lastErrorCode:null} as Parameters<MediaUsageRepository['upsertIndexStatus']>[0] & {skippedSourceCount:number});
  await owner.db.updateTable('_cms_media_usage_index_status' as never).set({collection_id:collectionId,
    capture_state:'installing',reconciliation_required:0} as never).execute();
  await installMediaUsageCaptureTriggers(db,{collectionId,collectionSlug:'fast_posts'});
  await owner.db.updateTable('_cms_media_usage_index_status' as never).set({capture_state:'active'} as never).execute();
  await owner.db.updateTable('_cms_media_usage_activation' as never).set({state:'active'} as never).execute();
});
const stateReceipts:unknown[]=[];
afterEach(async(context)=>{
  stateReceipts.push({test:context.task.name,actualNativeSchema:true,
    work:await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute(),
    sources:await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll().execute(),
    entries:await owner.db.selectFrom('ec_fast_posts' as never).selectAll().execute()});
  writeFileSync('/tmp/media-usage-maintenance-native-implicit-caller-state.json',JSON.stringify({
    sourceCausalCredit:0,nativeCallerValueReds:1,realProtectedProbes:false,stateReceipts},null,2)+'\n');
  await owner?.close();
});
// Consequence from the unchanged whole Source scheduled-driver family368–386.
// A controlled trusted principal reaches the actual internal runtime. No HTTP,
// authentication/session/PAT endpoint or protected live resource is probed.
it('awaits genuine durable usage processing before returning a successful content create',async()=>{
  const result=await nativeContentRuntime(owner,principal).handleContentCreate('fast_posts',{
    slug:'entry-1',status:'published',data:{title:'Entry 1'}});
  expect(result.success).toBe(true);
  expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).toEqual([]);
  if(!result.success)throw new Error('Successful receipt required');
  const key=buildContentMediaUsageSourceKey({collectionId,collectionSlug:'fast_posts',
    contentId:result.data.item.id,sourceVariant:'columns'});
  expect(await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll()
    .where('source_key' as never,'=',key as never).executeTakeFirst()).toBeDefined();
});
it('executes the genuine finite postcommit callback on the actual successful Native receipt',async()=>{
  const result=await nativeContentRuntime(owner,principal).handleContentCreate('fast_posts',{
    slug:'entry-1',status:'published',data:{title:'Entry 1'}});
  expect(result.success).toBe(true);
  if(!result.success)throw new Error('Successful receipt required');
  await refreshNativeContentUsageAfterSuccessfulWrite(owner,'fast_posts',[result.data.item.id]);
  expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).toEqual([]);
  const key=buildContentMediaUsageSourceKey({collectionId,collectionSlug:'fast_posts',
    contentId:result.data.item.id,sourceVariant:'columns'});
  expect(await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll()
    .where('source_key' as never,'=',key as never).executeTakeFirst()).toBeDefined();
});
