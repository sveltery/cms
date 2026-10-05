// Original Native sequential maintenance requirements; zero full Source cleanup/race/pipeline credit.
import {describe,expect,it} from 'vitest';
import {Miniflare} from 'miniflare';
import type {Kysely} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {openD1} from '../../src/lib/server/database/d1.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import type {Database} from '../../src/lib/server/blocks/upstream/database/types.ts';
import {MediaUsageRepository} from '../../src/lib/server/blocks/upstream/database/repositories/media-usage.ts';
const modules=import.meta.glob('../../src/lib/server/general-media/usage-cleanup.ts');

describe('Original trusted canonical media usage maintenance',()=>{
  it.each(['sqlite','d1'] as const)('%s matches pinned maintenance and preserves live usage and existing metadata',async kind=>{
    const worker=kind==='d1'?new Miniflare({modules:true,script:'export default {fetch(){return new Response("owned sequential maintenance fixture")}}',compatibilityDate:'2026-05-07',d1Databases:{CMS_DB:'native-media-usage-cleanup'},host:'127.0.0.1',port:0,cf:false}):undefined;
    const database=worker?openD1(await worker.getD1Database('CMS_DB')):openSqlite(':memory:');
    try{
      await migrateCms(database);
      const load=modules['../../src/lib/server/general-media/usage-cleanup.ts'];
      expect(load,'usable trusted media usage cleanup on the actual canonical owner').toBeTypeOf('function');
      const {cleanupGeneralMediaUsage}=await load() as Record<string,any>;
      // Actual canonical physical tables; direct fixtures do not implement a content/plugin writer.
      const db=database.db as unknown as Kysely<Database>;
      await db.insertInto('_cms_media_usage_sources').values({source_key:'plugin:owned-source',source_type:'plugin',collection_slug:null,content_id:null,source_variant:'columns',locale:null,translation_group:null,content_slug:null,content_title:null,content_status:null,content_scheduled_at:null,content_deleted_at:null,revision_id:null,current_generation:'live-generation',indexed_at:'2000-02-01T00:00:00.000Z'}).execute();
      const rows=[
        {id:'live',source_key:'plugin:owned-source',generation:'live-generation',created_at:'2000-01-01T00:00:00.000Z'},
        {id:'stale',source_key:'plugin:owned-source',generation:'stale-generation',created_at:'2000-01-01T00:00:00.000Z'},
        {id:'abandoned',source_key:'plugin:owned-source',generation:'abandoned-generation',created_at:'2000-03-01T00:00:00.000Z'},
        {id:'orphan',source_key:'plugin:absent-source',generation:'orphan-generation',created_at:'2000-01-01T00:00:00.000Z'}
      ];
      for(const row of rows)await db.insertInto('_cms_media_usage').values({...row,field_slug:'hero',field_path:row.id,reference_type:'image_field',media_id:'media-'+row.id,provider:'local',provider_asset_id:'media-'+row.id,media_kind:'image',mime_type:null}).execute();
      // Exact complete Source reproduction shows D1 includes its cleanup-fence trigger in changes.
      // Preserve that pinned bug; this correction of a new Native expectation earns no repair credit.
      const d1=kind==='d1';
      expect(await cleanupGeneralMediaUsage(database)).toMatchObject({status:'completed',candidateRows:4,deletedRows:d1?2:3,deletedOrphans:d1?2:1,deletedStale:d1?0:1,deletedAbandoned:d1?0:1,deletedWriteLeases:0,backlogLowerBound:3,scanHasMore:false});
      expect(await db.selectFrom('_cms_media_usage').select(['id','generation','media_id']).orderBy('id').execute()).toEqual(d1?[
        {id:'abandoned',generation:'abandoned-generation',media_id:'media-abandoned'},
        {id:'live',generation:'live-generation',media_id:'media-live'},
        {id:'stale',generation:'stale-generation',media_id:'media-stale'}
      ]:[{id:'live',generation:'live-generation',media_id:'media-live'}]);
      expect(await new MediaUsageRepository(db).findCurrentUsageByMediaId('media-live')).toHaveLength(1);
      expect(await db.selectFrom('_cms_media_usage_cleanup').select(['lease_token','last_deleted_orphans','last_deleted_stale','last_deleted_abandoned']).where('task_key','=','projection_gc').executeTakeFirst()).toEqual({lease_token:null,last_deleted_orphans:d1?2:1,last_deleted_stale:d1?0:1,last_deleted_abandoned:d1?0:1});
      await db.updateTable('_cms_media_usage_cleanup').set({lease_token:'owned-existing-lease',lease_expires_at:'2099-01-01T00:00:00.000Z',next_eligible_at:'2099-01-01T00:00:00.000Z',cursor_created_at:'2000-01-01T00:00:00.000Z',cursor_id:'owned-existing-cursor',consecutive_failures:7,last_error_code:'retained-existing-backoff'}).where('task_key','=','projection_gc').execute();
      const existing=await db.selectFrom('_cms_media_usage_cleanup').selectAll().where('task_key','=','projection_gc').executeTakeFirst();
      expect(await cleanupGeneralMediaUsage(database)).toMatchObject({status:'skipped',deletedRows:0});
      expect(await db.selectFrom('_cms_media_usage_cleanup').selectAll().where('task_key','=','projection_gc').executeTakeFirst()).toEqual(existing);
    }finally{await database.close();await worker?.dispose();}
  });
});
