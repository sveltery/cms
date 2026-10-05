import { afterEach, beforeEach, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { MediaUsageWorkRepository } from '../../src/lib/server/media-usage/upstream/database/repositories/media-usage-work.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import type { Kysely } from 'kysely';

let owner: CmsDatabase;
let repository: MediaUsageWorkRepository;
beforeEach(async () => {
  owner = openSqlite(':memory:');
  await migrateCms(owner);
  repository = new MediaUsageWorkRepository(owner.db as unknown as Kysely<Database>);
  await owner.db.insertInto('_cms_media_usage_work' as never).values({
    collection_id: 'collection-1', collection_slug: 'post', content_id: 'entry-1',
    change_epoch: 1, work_version: 1, next_attempt_at: '2000-01-01T00:00:00.000Z'
  } as never).execute();
});
afterEach(async () => { await owner?.close(); });

it('gives exactly one concurrent owner the due canonical work version', async () => {
  const claims = await Promise.all([repository.claimWork({collectionId:'collection-1',contentId:'entry-1',workVersion:1,leaseDurationSeconds:60}),
    repository.claimWork({collectionId:'collection-1',contentId:'entry-1',workVersion:1,leaseDurationSeconds:60})]);
  const winners = claims.filter(claim => claim !== null);
  expect(winners).toHaveLength(1);
  expect(winners[0]?.leaseToken).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  expect(winners[0]?.leaseExpiresAt! > winners[0]?.lastAttemptedAt!).toBe(true);
});

it('refuses to acknowledge a trigger-created newer version through the old lease', async () => {
  const claim = await repository.claimWork({collectionId:'collection-1',contentId:'entry-1',workVersion:1,leaseDurationSeconds:60});
  expect(claim).not.toBeNull();
  await owner.db.updateTable('_cms_media_usage_work' as never).set({work_version:2,change_epoch:2,state:'pending',lease_token:null,lease_expires_at:null} as never).execute();
  expect(await repository.completeWorkBatch([{collectionId:'collection-1',contentId:'entry-1',workVersion:1,leaseToken:claim!.leaseToken!}])).toEqual(new Set());
  const row = await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().executeTakeFirstOrThrow() as unknown as {work_version:number;state:string};
  expect(row.work_version).toBe(2);
  expect(row.state).toBe('pending');
});

it('leaves future work available for its actual due time', async () => {
  await owner.db.updateTable('_cms_media_usage_work' as never).set({next_attempt_at:'2999-01-01T00:00:00.000Z'} as never).execute();
  expect(await repository.claimWork({collectionId:'collection-1',contentId:'entry-1',workVersion:1,leaseDurationSeconds:60})).toBeNull();
  expect((await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll().execute()).length).toBe(1);
});
