// Native same-owner callback composition; no Original/protected probe changes.
import { expect, it } from 'vitest';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { seedSourceDatabase, seedNativeMediaUsageCollectionDeletionPhases } from '../../src/lib/server/seed/namespace.ts';
import { MediaUsageCollectionDeletionRepository } from '../../src/lib/server/media-usage/upstream/media/usage/collection-deletion.ts';

it('Node: named phase retains actual once-only receipt hooks inside a genuine callback transaction', async () => {
  const storage = await schemaAdminStorage('Node');
  try {
    await migrateCms(storage.database);
    const repository = new MediaUsageCollectionDeletionRepository(storage.database.db as unknown as ConstructorParameters<typeof MediaUsageCollectionDeletionRepository>[0]);
    await repository.createTombstone({ collectionId: 'transaction-cleanup', collectionSlug: 'transaction_posts', forceDelete: true });
    await sql`UPDATE _cms_media_usage_collection_deletions SET phase='sources' WHERE collection_id='transaction-cleanup'`.execute(storage.database.db);
    const claim = await repository.claim({ collectionId: 'transaction-cleanup', phase: 'sources', leaseDurationSeconds: 60 });
    if (!claim) throw new Error('Actual Native stored checkpoint was not claimed');
    const queries: unknown[] = [], results: unknown[] = [];
    const db = seedSourceDatabase(storage.database).withPlugin({
      transformQuery({ node, queryId }) { queries.push(queryId); return node; },
      async transformResult({ result, queryId }) { results.push(queryId); return result; },
    });
    await db.transaction().execute(async transaction => {
      const phases = await seedNativeMediaUsageCollectionDeletionPhases(transaction);
      expect(await phases.processSources(claim)).toBe(false);
    });
    const actual = (await sql`SELECT phase,state,lease_token FROM _cms_media_usage_collection_deletions WHERE collection_id='transaction-cleanup'`.execute(storage.database.db)).rows;
    expect(actual).toEqual([{ phase: 'status', state: 'leased', lease_token: claim.leaseToken }]);
    expect((await sql`SELECT token FROM _cms_guards`.execute(storage.database.db)).rows).toEqual([]);
    expect(queries.length).toBeGreaterThan(5);
    expect(new Set(queries).size).toBe(queries.length);
    expect(results).toEqual(queries);
  } finally { await storage.close(); }
}, 30000);
