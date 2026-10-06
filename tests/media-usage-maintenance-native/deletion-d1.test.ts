import { afterAll, afterEach, beforeAll, beforeEach, expect, it,vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { sql,type Kysely } from 'kysely';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../../src/lib/server/blocks/upstream/host.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';
import { processDueMediaUsageCollectionDeletions } from '../../src/lib/server/media-usage/upstream/media/usage/collection-deletion-processor.ts';

// New Native phase controls, separate from immutable original Source Workerd
// callbacks and clocks. One actual existing Workerd runtime serves this family.
let storage: Awaited<ReturnType<typeof asyncD1Storage>>;
let owner: CmsDatabase;
const persistedReceipts:unknown[]=[];
beforeAll(async () => {
  storage = await asyncD1Storage(); owner = openD1(storage.binding);
  await migrateCms(owner); registerBlockDatabaseHost(owner);
});
beforeEach(async () => {
  await sql`DROP TRIGGER IF EXISTS media_usage_phase_checkpoint_fixture`.execute(owner.db);
  await owner.db.deleteFrom('_cms_media_usage_work' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage_collection_deletions' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage_sources' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage' as never).execute();
});
afterAll(async () => { await owner?.close(); await storage?.runtime.dispose(); });
afterEach(async (context) => {
  const row = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never)
    .selectAll().executeTakeFirstOrThrow() as unknown as {
      phase:string;state:string;attempt_count:number;lease_token:string|null;
      lease_expires_at:string|null;work_cursor:string|null;source_key:string|null;
      occurrence_cursor:string|null;last_error_code:string|null;
    };
  const work = await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute();
  const receipt={
    test:context.task.name,
    phase:row.phase,state:row.state,attemptCount:row.attempt_count,
    leaseToken:row.lease_token,leaseExpiresAt:row.lease_expires_at,
    workCursor:row.work_cursor,sourceKey:row.source_key,
    occurrenceCursor:row.occurrence_cursor,lastErrorCode:row.last_error_code,
    remainingWorkRows:work.length,
    remainingSources:(await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll().execute()).length,
    remainingOccurrences:(await owner.db.selectFrom('_cms_media_usage' as never).selectAll().execute()).length,
    remainingGuards:(await owner.db.selectFrom('_cms_guards').selectAll().execute()).length,
  };
  persistedReceipts.push(receipt);
  writeFileSync('/tmp/media-usage-maintenance-d1-controlled-state-receipts.json',JSON.stringify({actualWorkerdBinding:true,
    actualCanonicalSchema:true,actualStoredRows:true,receipts:persistedReceipts},null,2)+'\n');
  console.info('Native controlled phase receipt', JSON.stringify(receipt));
});

async function expectReleased(phase:string) {
  const row=await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow();
  expect(row).toMatchObject({phase,state:'pending',attempt_count:0,lease_token:null,lease_expires_at:null,
    work_cursor:null,source_key:null,occurrence_cursor:null,last_error_code:null});
  expect(await owner.db.selectFrom('_cms_guards').selectAll().execute()).toEqual([]);
}

async function tombstone(phase: 'work' | 'sources' | 'status') {
  await owner.db.insertInto('_cms_media_usage_collection_deletions' as never).values({
    collection_id:'deleted-collection',collection_slug:'deleted_posts',force_delete:1,
    phase,next_attempt_at:'2000-01-01T00:00:00.000Z'
  } as never).execute();
}

it('deletes real due work and checkpoints sources on actual canonical D1', async () => {
  await tombstone('work');
  await owner.db.insertInto('_cms_media_usage_work' as never).values({collection_id:'deleted-collection',
    collection_slug:'deleted_posts',content_id:'entry-1',change_epoch:1,next_attempt_at:'2000-01-01T00:00:00.000Z'} as never).execute();
  expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'progress',claimedCount:1});
  expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).toEqual([]);
  const row = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {phase:string};
  expect(row.phase).toBe('sources');
  await expectReleased('sources');
});

it('checkpoints an empty real sources phase on actual canonical D1', async () => {
  await tombstone('sources');
  expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'progress'});
  const row = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {phase:string};
  expect(row.phase).toBe('status');
  await expectReleased('status');
});

it('clears real cleanup metadata and checkpoints finalization on canonical D1', async () => {
  await tombstone('status');
  expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'progress'});
  const row = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {phase:string};
  expect(row.phase).toBe('finalize');
  await expectReleased('finalize');
});

it('rolls back an actual work delete when a real checkpoint trigger ignores its update',async()=>{
  await tombstone('work');
  await owner.db.insertInto('_cms_media_usage_work' as never).values({collection_id:'deleted-collection',
    collection_slug:'deleted_posts',content_id:'entry-1',change_epoch:1,next_attempt_at:'2000-01-01T00:00:00.000Z'} as never).execute();
  await sql`CREATE TRIGGER media_usage_phase_checkpoint_fixture BEFORE UPDATE OF phase ON _cms_media_usage_collection_deletions
    WHEN NEW.collection_id='deleted-collection' AND NEW.phase='sources' BEGIN SELECT RAISE(IGNORE); END`.execute(owner.db);
  const batch=vi.spyOn(owner,'atomicBatch');const errors=vi.spyOn(console,'error');
  try{
    expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'retry'});
    expect(batch).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls.some(call=>String(call[1]).includes('CHECK constraint failed: pass = 1'))).toBe(true);
    expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).toHaveLength(1);
    expect(await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow())
      .toMatchObject({phase:'work',state:'retry',attempt_count:1,lease_token:null,last_error_code:'MEDIA_USAGE_COLLECTION_DELETION_FAILED'});
    expect(await owner.db.selectFrom('_cms_guards').selectAll().execute()).toEqual([]);
  }finally{batch.mockRestore();errors.mockRestore();}
});

it('rolls back occurrences, source deletion and initial checkpoint when a later real checkpoint is missed',async()=>{
  await tombstone('sources');
  await owner.db.insertInto('_cms_media_usage_sources' as never).values({source_key:'source-1',source_type:'content',
    source_variant:'columns',current_generation:'generation-1',collection_id:'deleted-collection',
    collection_slug:'deleted_posts',content_id:'entry-1'} as never).execute();
  await owner.db.insertInto('_cms_media_usage' as never).values({id:'occurrence-1',source_key:'source-1',
    generation:'generation-1',field_slug:'image',field_path:'image',reference_type:'image_field',
    provider_asset_id:'controlled-asset'} as never).execute();
  await sql`CREATE TRIGGER media_usage_phase_checkpoint_fixture BEFORE UPDATE OF source_key ON _cms_media_usage_collection_deletions
    WHEN NEW.collection_id='deleted-collection' AND OLD.source_key='source-1' AND NEW.source_key IS NULL BEGIN SELECT RAISE(IGNORE); END`.execute(owner.db);
  const batch=vi.spyOn(owner,'atomicBatch');const errors=vi.spyOn(console,'error');
  try{
    expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'retry'});
    expect(batch).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls.some(call=>String(call[1]).includes('CHECK constraint failed: pass = 1'))).toBe(true);
    expect(await owner.db.selectFrom('_cms_media_usage_sources' as never).selectAll().execute()).toHaveLength(1);
    expect(await owner.db.selectFrom('_cms_media_usage' as never).selectAll().execute()).toHaveLength(1);
    expect(await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow())
      .toMatchObject({phase:'sources',source_key:null,occurrence_cursor:null,state:'retry',attempt_count:1,lease_token:null});
    expect(await owner.db.selectFrom('_cms_guards').selectAll().execute()).toEqual([]);
  }finally{batch.mockRestore();errors.mockRestore();}
});

it('observes each actual compiled phase query and its genuine result exactly once with the same query ID',async()=>{
  const base=owner;const queries:unknown[]=[],results:unknown[]=[];
  owner={...base,db:base.db.withPlugin({transformQuery({node,queryId}){queries.push(queryId);return node;},
    async transformResult({result,queryId}){results.push(queryId);return result;}})};
  registerBlockDatabaseHost(owner);
  try{
    await tombstone('sources');queries.length=0;results.length=0;
    expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'progress'});
    expect(queries.length).toBeGreaterThan(5);expect(results).toEqual(queries);
  }finally{owner=base;registerBlockDatabaseHost(owner);}
});
