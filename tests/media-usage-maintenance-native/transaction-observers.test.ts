// Distinct Native owner composition controls; complete Original Source tests are unchanged.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { sql, type KyselyPlugin, type QueryResult, type UnknownRow } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { seedDatabaseOwner, seedSourceDatabase, seedNativeMediaUsageCollectionDeletionPhases } from '../../src/lib/server/seed/namespace.ts';
import { MediaUsageCollectionDeletionRepository } from '../../src/lib/server/media-usage/upstream/media/usage/collection-deletion.ts';

let owner: CmsDatabase;
beforeEach(async () => { owner = openSqlite(':memory:'); await migrateCms(owner); });
afterEach(async () => { await owner?.close(); });

async function prepareWork() {
  const repository = new MediaUsageCollectionDeletionRepository(owner.db as unknown as ConstructorParameters<typeof MediaUsageCollectionDeletionRepository>[0]);
  await repository.createTombstone({ collectionId: 'native-transaction-deletion', collectionSlug: 'deleted_posts', forceDelete: true });
  await sql`UPDATE _cms_media_usage_collection_deletions SET phase='work' WHERE collection_id='native-transaction-deletion'`.execute(owner.db);
  await sql`INSERT INTO _cms_media_usage_work(collection_id,collection_slug,content_id,change_epoch,next_attempt_at)
    VALUES('native-transaction-deletion','deleted_posts','actual-work',1,'2000-01-01T00:00:00.000Z')`.execute(owner.db);
  const claim = await repository.claim({ collectionId: 'native-transaction-deletion', phase: 'work', leaseDurationSeconds: 60 });
  if (!claim) throw new Error('The actual work checkpoint was not claimed');
  return claim;
}

it('commits real work cleanup while each caller receives each actual transaction receipt once', async () => {
  const claim = await prepareWork();
  const queryIds: unknown[] = [], firstResultIds: unknown[] = [], secondResultIds: unknown[] = [];
  const actualReceipts: QueryResult<UnknownRow>[] = [];
  const caller = (resultIds: unknown[]): KyselyPlugin => ({
    transformQuery({ node, queryId }) { if (resultIds === firstResultIds) queryIds.push(queryId); return node; },
    async transformResult({ result, queryId }) {
      resultIds.push(queryId); if (resultIds === firstResultIds) actualReceipts.push(result); return result;
    }
  });
  const db = seedSourceDatabase(owner).withPlugin(caller(firstResultIds)).withPlugin(caller(secondResultIds));
  await db.transaction().execute(async transaction => {
    expect(transaction.isTransaction).toBe(true);
    expect(seedDatabaseOwner(transaction).db.isTransaction).toBe(true);
    const phases = await seedNativeMediaUsageCollectionDeletionPhases(transaction);
    expect(await phases.processWork(claim)).toBe(false);
  });
  const checkpoint = (await sql`SELECT phase,state,lease_token FROM _cms_media_usage_collection_deletions
    WHERE collection_id='native-transaction-deletion'`.execute(owner.db)).rows;
  const remainingWork = (await sql`SELECT content_id FROM _cms_media_usage_work WHERE collection_id='native-transaction-deletion'`.execute(owner.db)).rows;
  const guards = (await sql`SELECT token FROM _cms_guards`.execute(owner.db)).rows;
  writeFileSync('/tmp/media-usage-maintenance-native-transaction-observer-state.json', JSON.stringify({
    sourceTestsUnchanged: true, sourceIdentityCredit: 0, checkpoint, remainingWork, guards,
    queryCount: queryIds.length, firstResultCount: firstResultIds.length, secondResultCount: secondResultIds.length,
    firstResultQueryIndexes: firstResultIds.map(id => queryIds.indexOf(id)),
    secondResultQueryIndexes: secondResultIds.map(id => queryIds.indexOf(id)), actualReceipts
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
  expect(checkpoint).toEqual([{ phase: 'sources', state: 'leased', lease_token: claim.leaseToken }]);
  expect(remainingWork).toEqual([]);
  expect(guards).toEqual([]);
  expect(queryIds.length).toBeGreaterThan(5);
  expect(new Set(queryIds).size).toBe(queryIds.length);
  expect(firstResultIds).toEqual(queryIds);
  expect(secondResultIds).toEqual(queryIds);
  expect(actualReceipts.some(receipt => receipt.rows.some(row => row.collection_id === claim.collectionId))).toBe(true);
});

it('rolls back the actual Node transaction when a caller rejects its genuine checkpoint receipt', async () => {
  const claim = await prepareWork();
  const checkpointQueryIds: unknown[] = [];
  const failure = new Error('controlled actual checkpoint observer failure');
  const db = seedSourceDatabase(owner).withPlugin({
    transformQuery({ node }) { return node; },
    async transformResult({ result, queryId }) {
      if (result.rows.some(row => row.collection_id === claim.collectionId)) {
        checkpointQueryIds.push(queryId); throw failure;
      }
      return result;
    }
  });
  await expect(db.transaction().execute(async transaction => {
    const phases = await seedNativeMediaUsageCollectionDeletionPhases(transaction);
    await phases.processWork(claim);
  })).rejects.toBe(failure);
  expect(checkpointQueryIds).toHaveLength(1);
  expect((await sql`SELECT phase,state,lease_token FROM _cms_media_usage_collection_deletions
    WHERE collection_id='native-transaction-deletion'`.execute(owner.db)).rows)
    .toEqual([{ phase: 'work', state: 'leased', lease_token: claim.leaseToken }]);
  expect((await sql`SELECT content_id FROM _cms_media_usage_work WHERE collection_id='native-transaction-deletion'`.execute(owner.db)).rows)
    .toEqual([{ content_id: 'actual-work' }]);
  expect((await sql`SELECT token FROM _cms_guards`.execute(owner.db)).rows).toEqual([]);
});
