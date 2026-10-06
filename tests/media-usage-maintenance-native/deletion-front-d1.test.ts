import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { sql, type Kysely } from 'kysely';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../../src/lib/server/blocks/upstream/host.ts';
import { activateMediaUsageCapture } from '../../src/lib/server/blocks/upstream/media/usage/activation.ts';
import { verifyMediaUsageCaptureTriggers } from '../../src/lib/server/blocks/upstream/media/usage/capture-triggers.ts';
import { FTSManager } from '../../src/lib/server/content-picker/fts-manager.ts';
import { MediaUsageCollectionDeletionRepository } from '../../src/lib/server/media-usage/upstream/media/usage/collection-deletion.ts';
import { deleteNativeActivatedMediaUsageCollection, processNativeDueMediaUsageCollectionDeletions } from '../../src/lib/server/media-usage/index.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';

// New Native consequences, distinct from whole immutable Source families.
// Phase fixtures write actual canonical rows; no Source callback is emulated.
let storage: Awaited<ReturnType<typeof asyncD1Storage>>;
let owner: CmsDatabase;
let collectionId: string;
let collectionSlug: string;
let ordinal = 0;
const receipts: unknown[] = [];
const database = () => owner.db as unknown as Kysely<Database>;
beforeAll(async () => {
  storage = await asyncD1Storage();
  owner = openD1(storage.binding);
  await migrateCms(owner);
  registerBlockDatabaseHost(owner);
  expect(await activateMediaUsageCapture(database(), { writersDrained: true }))
    .toMatchObject({ outcome: 'active', processedCollections: 0 });
});
beforeEach(async () => {
  // Each case has its own real collection, capture lifecycle and FTS producer.
  // Remove preceding case tombstones so due-work selection is deterministic.
  await owner.db.deleteFrom('_cms_media_usage_collection_deletions' as never).execute();
  collectionSlug = `native_front_${++ordinal}`;
  collectionId = (await new SchemaRegistry(owner).createCollection({ slug: collectionSlug, label: 'Native front phase' })).id;
  expect(await verifyMediaUsageCaptureTriggers(database(), { collectionId, collectionSlug })).toBe(true);
  await new FTSManager(owner.db as never).createFtsTable(collectionSlug, ['slug']);
});
afterEach(async (context) => {
  const objects = await sql<{ type: string; name: string }>`SELECT type, name FROM sqlite_master
    WHERE name = ${`ec_${collectionSlug}`} OR name LIKE ${`_cms_fts_${collectionSlug}%`}
    ORDER BY type, name`.execute(owner.db);
  receipts.push({ test: context.task.name, collectionId, collectionSlug,
    registry: await owner.db.selectFrom('_cms_collections').selectAll().where('id', '=', collectionId).execute(),
    deletion: await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().execute(),
    status: await owner.db.selectFrom('_cms_media_usage_index_status' as never).selectAll()
      .where('collection_id' as never, '=', collectionId as never).execute(),
    work: await owner.db.selectFrom('_cms_media_usage_work' as never).selectAll()
      .where('collection_id' as never, '=', collectionId as never).execute(),
    objects: objects.rows,
    sentinels: await sql`SELECT * FROM _cms_media_usage_collection_deletions
      WHERE collection_id LIKE '__emdash_guard:%' OR collection_slug LIKE '__emdash_guard_slug:%'`.execute(owner.db),
  });
  writeFileSync('/tmp/media-usage-maintenance-native-front-d1-state.json', JSON.stringify({
    actualWorkerdBinding: true, actualCanonicalSchema: true, actualCaptureAndFtsProducers: true,
    phaseFixtureCredit: 'controlled actual stored prerequisites, zero Source body parity',
    sourceBodyIdentityCredit: 0, realProtectedProbes: false, receipts,
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
});
afterAll(async () => { await owner?.close(); await storage?.runtime.dispose(); });

async function phaseFixture(phase: 'fence' | 'registry' | 'table' | 'finalize') {
  const repository = new MediaUsageCollectionDeletionRepository(database());
  await repository.createTombstone({ collectionId, collectionSlug, forceDelete: true });
  // Literal Source phase prerequisites, separately labeled; these UPDATEs do
  // not assert that the preceding missing Native front phase already ran.
  await owner.db.updateTable('_cms_media_usage_collection_deletions' as never)
    .set({ phase, next_attempt_at: '2000-01-01T00:00:00.000Z' } as never)
    .where('collection_id' as never, '=', collectionId as never).execute();
  return repository;
}
async function expectPending(phase: string) {
  expect(await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll()
    .where('collection_id' as never, '=', collectionId as never).executeTakeFirstOrThrow())
    .toMatchObject({ phase, state: 'pending', attempt_count: 0, lease_token: null, lease_expires_at: null });
}

it('preserves actual live content and cancels its nonforce fence tombstone', async () => {
  await sql`INSERT INTO ${sql.ref(`ec_${collectionSlug}`)} (id, slug, status)
    VALUES ('native-front-entry', 'native-front-entry', 'published')`.execute(owner.db);
  expect(await deleteNativeActivatedMediaUsageCollection(owner, { collectionId, collectionSlug, forceDelete: false }))
    .toBe('has_content');
  expect((await sql`SELECT id FROM ${sql.ref(`ec_${collectionSlug}`)}`.execute(owner.db)).rows).toHaveLength(1);
  expect(await owner.db.selectFrom('_cms_collections').select('id').where('id', '=', collectionId).execute()).toHaveLength(1);
  expect(await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().execute()).toEqual([]);
  expect(await owner.db.selectFrom('_cms_media_usage_index_status' as never).selectAll()
    .where('collection_id' as never, '=', collectionId as never).executeTakeFirstOrThrow())
    .toMatchObject({ capture_state: 'active' });
});

it('fences an actual empty captured collection and releases a registry checkpoint', async () => {
  await phaseFixture('fence');
  expect(await processNativeDueMediaUsageCollectionDeletions(owner)).toMatchObject({ outcome: 'progress', claimedCount: 1 });
  await expectPending('registry');
  expect(await owner.db.selectFrom('_cms_media_usage_index_status' as never).selectAll()
    .where('collection_id' as never, '=', collectionId as never).executeTakeFirstOrThrow())
    .toMatchObject({ capture_state: 'deleting' });
});

it('removes only the actual registry identity and checkpoints its table phase', async () => {
  await phaseFixture('registry');
  expect(await processNativeDueMediaUsageCollectionDeletions(owner)).toMatchObject({ outcome: 'progress', claimedCount: 1 });
  expect(await owner.db.selectFrom('_cms_collections').select('id').where('id', '=', collectionId).execute()).toEqual([]);
  expect((await sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${`ec_${collectionSlug}`}`.execute(owner.db)).rows)
    .toHaveLength(1);
  await expectPending('table');
});

it('drops real canonical FTS objects and content table and leaves no sentinel', async () => {
  await phaseFixture('table');
  expect(await processNativeDueMediaUsageCollectionDeletions(owner)).toMatchObject({ outcome: 'progress', claimedCount: 1 });
  await expectPending('work');
  expect((await sql`SELECT name FROM sqlite_master WHERE name=${`ec_${collectionSlug}`}
    OR name LIKE ${`_cms_fts_${collectionSlug}%`}`.execute(owner.db)).rows).toEqual([]);
  expect((await sql`SELECT collection_id FROM _cms_media_usage_collection_deletions
    WHERE collection_id LIKE '__emdash_guard:%'`.execute(owner.db)).rows).toEqual([]);
});

it('finalizes the real tombstone when actual table, registry and cleanup prerequisites are absent', async () => {
  await phaseFixture('finalize');
  // Real stored absence fixtures for the unchanged direct Source finalizer;
  // no claim of preceding front/cleanup phase behavior follows from these.
  await new FTSManager(owner.db as never).dropFtsTable(collectionSlug);
  await sql`DROP TABLE ${sql.ref(`ec_${collectionSlug}`)}`.execute(owner.db);
  await owner.db.deleteFrom('_cms_collections').where('id', '=', collectionId).execute();
  await owner.db.deleteFrom('_cms_media_usage_index_status' as never)
    .where('collection_id' as never, '=', collectionId as never).execute();
  expect(await processNativeDueMediaUsageCollectionDeletions(owner)).toMatchObject({ outcome: 'finalized', claimedCount: 1 });
  expect(await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().execute()).toEqual([]);
});

it('records a truthful finalization retry while its actual content table still exists', async () => {
  await phaseFixture('finalize');
  expect(await processNativeDueMediaUsageCollectionDeletions(owner)).toMatchObject({ outcome: 'retry', claimedCount: 1 });
  expect(await owner.db.selectFrom('_cms_media_usage_collection_deletions' as never).selectAll().executeTakeFirstOrThrow())
    .toMatchObject({ phase: 'finalize', state: 'retry', attempt_count: 1,
      lease_token: null, last_error_code: 'MEDIA_USAGE_COLLECTION_DELETION_FAILED' });
  expect((await sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${`ec_${collectionSlug}`}`.execute(owner.db)).rows)
    .toHaveLength(1);
});
