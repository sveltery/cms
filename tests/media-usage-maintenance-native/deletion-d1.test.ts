import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
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
beforeAll(async () => {
  storage = await asyncD1Storage(); owner = openD1(storage.binding);
  await migrateCms(owner); registerBlockDatabaseHost(owner);
});
beforeEach(async () => {
  await owner.db.deleteFrom('_cms_media_usage_work' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage_collection_deletions' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage_sources' as never).execute();
  await owner.db.deleteFrom('_cms_media_usage' as never).execute();
});
afterAll(async () => { await owner?.close(); await storage?.runtime.dispose(); });
afterEach(async () => {
  if (process.env.MEDIA_USAGE_PHASE_RECEIPTS !== '1') return;
  const row = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never)
    .selectAll().executeTakeFirstOrThrow() as unknown as {
      phase:string;state:string;attempt_count:number;lease_token:string|null;
      lease_expires_at:string|null;work_cursor:string|null;source_key:string|null;
      occurrence_cursor:string|null;last_error_code:string|null;
    };
  const work = await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute();
  console.info('Native controlled phase receipt', JSON.stringify({
    phase:row.phase,state:row.state,attemptCount:row.attempt_count,
    leaseToken:row.lease_token,leaseExpiresAt:row.lease_expires_at,
    workCursor:row.work_cursor,sourceKey:row.source_key,
    occurrenceCursor:row.occurrence_cursor,lastErrorCode:row.last_error_code,
    remainingWorkRows:work.length,
  }));
});

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
});

it('checkpoints an empty real sources phase on actual canonical D1', async () => {
  await tombstone('sources');
  expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'progress'});
  const row = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {phase:string};
  expect(row.phase).toBe('status');
});

it('clears real cleanup metadata and checkpoints finalization on canonical D1', async () => {
  await tombstone('status');
  expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'progress'});
  const row = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {phase:string};
  expect(row.phase).toBe('finalize');
});
