import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { processDueMediaUsageCollectionDeletions } from '../../src/lib/server/media-usage/upstream/media/usage/collection-deletion-processor.ts';
import { observeProducerPlans } from './plan-observer.ts';

let owner: CmsDatabase;
let observer:ReturnType<typeof observeProducerPlans>;
let planName:string;
beforeEach(async () => {
  owner = openSqlite(':memory:'); await migrateCms(owner);
  observer=observeProducerPlans(owner); owner=observer.owner;
});
afterEach(async () => { observer.save(planName); await owner?.close(); });

async function tombstone(phase: 'work' | 'sources' | 'status') {
  await owner.db.insertInto('_cms_media_usage_collection_deletions' as never).values({
    collection_id:'deleted-collection', collection_slug:'deleted_posts', force_delete:1,
    phase, next_attempt_at:'2000-01-01T00:00:00.000Z'
  } as never).execute();
}

it('consumes a genuine bounded work phase and checkpoints its next phase', async () => {
  planName='work';
  await tombstone('work');
  await owner.db.insertInto('_cms_media_usage_work' as never).values({collection_id:'deleted-collection',
    collection_slug:'deleted_posts',content_id:'entry-1',change_epoch:1,next_attempt_at:'2000-01-01T00:00:00.000Z'} as never).execute();
  const outcome = await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>);
  expect(outcome).toMatchObject({candidateCount:1,claimedCount:1,outcome:'progress'});
  expect(await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).toEqual([]);
  const deletion = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {phase:string;lease_token:string|null};
  expect(deletion.phase).toBe('sources');
  expect(deletion.lease_token).toBeNull();
});

it('finishes an empty sources phase through the persisted status checkpoint', async () => {
  planName='empty-sources';
  await tombstone('sources');
  expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'progress'});
  const deletion = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {phase:string};
  expect(deletion.phase).toBe('status');
});

it('refuses finalization while actual content work remains and records a retry', async () => {
  planName='refused-status';
  await tombstone('status');
  await owner.db.insertInto('_cms_media_usage_work' as never).values({collection_id:'deleted-collection',
    collection_slug:'deleted_posts',content_id:'entry-1',change_epoch:1,next_attempt_at:'2000-01-01T00:00:00.000Z'} as never).execute();
  expect(await processDueMediaUsageCollectionDeletions(owner.db as unknown as Kysely<Database>)).toMatchObject({outcome:'retry'});
  const deletion = await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow() as unknown as {state:string;phase:string;attempt_count:number;last_error_code:string};
  expect(deletion.state).toBe('retry');
  expect(deletion.phase).toBe('status');
  expect(deletion.attempt_count).toBe(1);
  expect(deletion.last_error_code).toBe('MEDIA_USAGE_COLLECTION_DELETION_FAILED');
});
