import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { MediaUsageRepository } from '../../src/lib/server/blocks/upstream/database/repositories/media-usage.ts';
import { MediaUsageReconciliationRepository } from '../../src/lib/server/media-usage/upstream/media/usage/reconciliation.ts';

let owner: CmsDatabase;
let repository: MediaUsageReconciliationRepository;
let collectionId: string;
beforeEach(async () => {
  owner = openSqlite(':memory:'); await migrateCms(owner);
  const collection = await new SchemaRegistry(owner).createCollection({slug:'post',label:'Posts'});
  collectionId = collection.id;
  await owner.db.updateTable('_cms_media_usage_activation' as never).set({state:'active'} as never).execute();
  // Main's ordinary schema creator has no Source capture/status integration yet.
  // Establish this controlled preexisting activated collection through its real
  // canonical repository, without pretending an UPDATE of zero rows created it.
  await new MediaUsageRepository(owner.db as unknown as Kysely<Database>).upsertIndexStatus({
    adapterId:'content-media',scopeType:'collection',scopeKey:'post',status:'stale'
  });
  await owner.db.updateTable('_cms_media_usage_index_status' as never).set({collection_id:collectionId,
    capture_state:'active',reconciliation_required:1} as never).where('scope_key' as never,'=','post' as never).execute();
  repository = new MediaUsageReconciliationRepository(owner.db as unknown as Kysely<Database>);
});
afterEach(async () => { await owner?.close(); });

it('discovers actual stale canonical metadata and creates exactly one reconciliation', async () => {
  expect(await repository.seedNextCandidate()).toBe(true);
  expect(await repository.seedNextCandidate()).toBe(false);
  const rows = await owner.db.selectFrom('_cms_media_usage_reconciliations' as never).selectAll().execute() as unknown as {collection_id:string;phase:string;run_token:string}[];
  expect(rows).toHaveLength(1);
  expect(rows[0]?.collection_id).toBe(collectionId);
  expect(rows[0]?.phase).toBe('scan');
  expect(rows[0]?.run_token).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
});

it('excludes a genuinely deleting collection from discovery', async () => {
  await owner.db.insertInto('_cms_media_usage_collection_deletions' as never).values({collection_id:collectionId,
    collection_slug:'post',force_delete:1,next_attempt_at:'2000-01-01T00:00:00.000Z'} as never).execute();
  expect(await repository.seedNextCandidate()).toBe(false);
  expect(await owner.db.selectFrom('_cms_media_usage_reconciliations' as never).selectAll().execute()).toEqual([]);
});
