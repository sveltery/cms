// Genuine Native repair consumers, distinct from the complete immutable Original
// Source family retained under parity. Original Source consequence458/521/557
// values are retained; this fixture uses the actual Native schema/physical owner.
import { afterAll,afterEach,beforeAll,beforeEach,expect,it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { sql,type Kysely } from 'kysely';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../../src/lib/server/blocks/upstream/host.ts';
import { MediaUsageRepository } from '../../src/lib/server/blocks/upstream/database/repositories/media-usage.ts';
import { repairContentMediaUsageCollection } from '../../src/lib/server/media-usage/upstream/media/usage/content-repair.ts';
let storage:Awaited<ReturnType<typeof asyncD1Storage>>,owner:CmsDatabase;
const receipts:unknown[]=[];
beforeAll(async()=>{
  storage=await asyncD1Storage();owner=openD1(storage.binding);await migrateCms(owner);registerBlockDatabaseHost(owner);
  const registry=new SchemaRegistry(owner);await registry.createCollection({slug:'posts',label:'Posts'});
  await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
  await registry.createField('posts',{slug:'hero',label:'Hero',type:'image'});
});
beforeEach(async()=>{
  await sql`DROP TRIGGER IF EXISTS media_usage_native_fresher_columns`.execute(owner.db);
  await owner.db.deleteFrom('_cms_media_usage' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage_sources' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage_index_status' as never).execute();
  await owner.db.deleteFrom('ec_posts' as never).execute();
  await owner.db.deleteFrom('_cms_revisions' as never).execute();
});
afterEach(async(context)=>{
  receipts.push({test:context.task.name,actualNativePhysicalOwner:true,
    sources:await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll().execute(),
    occurrences:await owner.db.selectFrom('_cms_media_usage' as never).selectAll().execute(),
    statuses:await owner.db.selectFrom('_cms_media_usage_index_status' as never).selectAll().execute()});
  writeFileSync('/tmp/media-usage-maintenance-native-repair-d1-state.json',JSON.stringify({
    sourceWholeFamilyUnchanged:true,sourceBodyIdentityCredit:0,actualWorkerd:true,receipts},null,2)+'\n');
});
afterAll(async()=>{await owner?.close();await storage?.runtime.dispose();});
function db(){return owner.db as unknown as Kysely<Database>;}
function key(id:string,variant:'columns'|'draft_overlay'){return `content:posts:${id}:${variant}`;}
async function entry(id:string,mediaId:string,missing=false){
  await sql`INSERT INTO ec_posts (id,slug,status,title,hero,draft_revision_id) VALUES (
    ${id},${id},'published',${id},${JSON.stringify({id:mediaId,provider:'local',mimeType:'image/webp'})},NULL)`.execute(owner.db);
  if(!missing)await owner.db.insertInto('_cms_revisions' as never).values({
    id:'mismatched_revision',collection:'pages',entry_id:id,
    data:JSON.stringify({hero:{id:'media-draft',provider:'local'}})} as never).execute();
  // Native content tables have no FK on draft_revision_id; the Source whole
  // fixture's PRAGMA mutation is not emulated or issued on this D1 binding.
  await sql`UPDATE ec_posts SET draft_revision_id=${missing?'missing_revision':'mismatched_revision'} WHERE id=${id}`.execute(owner.db);
}
async function expectFailedDraft(id:string,error:string){
  const repo=new MediaUsageRepository(db());
  expect(await repo.findSource(key(id,'columns'))).toEqual(expect.objectContaining({sourceCompleteness:'complete'}));
  expect(await repo.findSource(key(id,'draft_overlay'))).toEqual(expect.objectContaining({sourceCompleteness:'failed',lastErrorCode:error}));
}
it('indexes valid columns and records the actual mismatched draft failure on canonical D1',async()=>{
  await entry('post_failed_source','media-unindexed');
  const result=await repairContentMediaUsageCollection(db(),{collectionSlug:'posts'});
  expect(result).toEqual(expect.objectContaining({status:'partial',indexedSourceCount:1,failedSourceCount:1,
    skippedSourceCount:0,deletedSourceCount:0,lastErrorCode:'DRAFT_REVISION_MISMATCH'}));
  await expectFailedDraft('post_failed_source','DRAFT_REVISION_MISMATCH');
  expect(await new MediaUsageRepository(db()).findCurrentUsageByMediaId('media-unindexed')).toHaveLength(1);
  expect(await new MediaUsageRepository(db()).findIndexStatus({adapterId:'content-media',scopeType:'collection',scopeKey:'posts'}))
    .toEqual(expect.objectContaining({status:'partial',indexedSourceCount:1,failedSourceCount:1,lastErrorCode:'DRAFT_REVISION_MISMATCH'}));
});
it('indexes valid columns and records the actual missing draft failure on canonical D1',async()=>{
  await entry('post_missing_draft_revision','media-missing-draft',true);
  const result=await repairContentMediaUsageCollection(db(),{collectionSlug:'posts'});
  expect(result).toEqual(expect.objectContaining({status:'partial',indexedSourceCount:1,failedSourceCount:1,
    skippedSourceCount:0,deletedSourceCount:0,lastErrorCode:'DRAFT_REVISION_NOT_FOUND'}));
  await expectFailedDraft('post_missing_draft_revision','DRAFT_REVISION_NOT_FOUND');
  expect(await new MediaUsageRepository(db()).findCurrentUsageByMediaId('media-missing-draft')).toHaveLength(1);
});
it('keeps failed coverage when a real concurrent trigger installs a fresher columns source',async()=>{
  await entry('post_conflict','media-repair');
  await sql`CREATE TRIGGER media_usage_native_fresher_columns AFTER INSERT ON _cms_media_usage
    WHEN NEW.media_id='media-repair' BEGIN
    INSERT OR IGNORE INTO _cms_media_usage_sources (source_key,source_type,collection_slug,content_id,source_variant,
      locale,translation_group,content_slug,content_title,content_status,current_generation,schema_version,
      source_updated_at,source_version,source_fingerprint,source_completeness,last_attempted_at,indexed_at,created_at,updated_at)
    VALUES ('content:posts:post_conflict:columns','content','posts','post_conflict','columns','en','post_conflict',
      'runtime-fresh-columns','Runtime Fresh Columns','published','trigger_columns_generation',1,
      '2099-01-01T00:00:01.000Z',2,'runtime-fresher-columns','complete','2099-01-01T00:00:01.000Z',
      '2099-01-01T00:00:01.000Z','2099-01-01T00:00:01.000Z','2099-01-01T00:00:01.000Z');
    INSERT OR IGNORE INTO _cms_media_usage (id,source_key,generation,field_slug,field_path,occurrence_index,reference_type,
      media_id,provider,provider_asset_id,media_kind,mime_type,created_at)
    VALUES ('usage_trigger_columns','content:posts:post_conflict:columns','trigger_columns_generation','hero','hero',0,
      'image_field','media-fresher-columns','local','media-fresher-columns','image','image/webp','2099-01-01T00:00:01.000Z');
    END`.execute(owner.db);
  const result=await repairContentMediaUsageCollection(db(),{collectionSlug:'posts'});
  expect(result).toEqual(expect.objectContaining({status:'failed',indexedSourceCount:0,failedSourceCount:1,
    skippedSourceCount:1,deletedSourceCount:0,lastErrorCode:'DRAFT_REVISION_MISMATCH'}));
  const repo=new MediaUsageRepository(db());
  expect(await repo.findSource(key('post_conflict','columns'))).toEqual(expect.objectContaining({
    currentGeneration:'trigger_columns_generation',contentTitle:'Runtime Fresh Columns',sourceFingerprint:'runtime-fresher-columns'}));
  expect(await repo.findSource(key('post_conflict','draft_overlay'))).toEqual(expect.objectContaining({
    sourceCompleteness:'failed',lastErrorCode:'DRAFT_REVISION_MISMATCH'}));
  expect(await repo.findCurrentUsageByMediaId('media-fresher-columns')).toHaveLength(1);
  expect(await repo.findCurrentUsageByMediaId('media-repair')).toHaveLength(0);
});
