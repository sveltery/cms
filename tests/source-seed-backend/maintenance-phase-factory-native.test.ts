// Native named-domain composition controls, separate from Original callbacks.
import { spawnSync } from 'node:child_process';
import { expect, it, vi } from 'vitest';
import { sql, type KyselyPlugin } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import * as namespace from '../../src/lib/server/seed/namespace.ts';
import { NativeMediaUsageCollectionDeletionPhases } from '../../src/lib/server/media-usage/collection-deletion-phases.ts';
import { MediaUsageCollectionDeletionRepository } from '../../src/lib/server/media-usage/upstream/media/usage/collection-deletion.ts';

async function fixture(target: 'Node' | 'D1') {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    const view = namespace.seedSourceDatabase(storage.database);
    return { storage, view };
  } catch (error) { await storage.close(); throw error; }
}
async function claim(f: Awaited<ReturnType<typeof fixture>>) {
  const repository = new MediaUsageCollectionDeletionRepository(f.storage.database.db as unknown as ConstructorParameters<typeof MediaUsageCollectionDeletionRepository>[0]);
  await repository.createTombstone({ collectionId: 'actual-cleanup', collectionSlug: 'deleted_posts', forceDelete: true });
  await sql`UPDATE _cms_media_usage_collection_deletions SET phase='sources' WHERE collection_id='actual-cleanup'`.execute(f.storage.database.db);
  const stored = await repository.claim({ collectionId: 'actual-cleanup', phase: 'sources', leaseDurationSeconds: 60 });
  if (!stored) throw new Error('Actual Native fixture failed to claim its stored tombstone');
  return stored;
}
async function observedPhase(f: Awaited<ReturnType<typeof fixture>>, useFactory: boolean) {
  const stored = await claim(f), queries: unknown[] = [], results: unknown[] = [], order: string[] = [];
  const first: KyselyPlugin = {
    transformQuery({ node, queryId }) { queries.push(queryId); order.push('query:first'); return node; },
    async transformResult({ result, queryId }) { results.push(queryId); order.push('result:first'); return result; },
  };
  const second: KyselyPlugin = {
    transformQuery({ node }) { order.push('query:second'); return node; },
    async transformResult({ result }) { order.push('result:second'); return result; },
  };
  const view = f.view.withPlugin(first).withPlugin(second);
  const batch = vi.spyOn(f.storage.database, 'atomicBatch');
  try {
    const phases = useFactory
      ? await Reflect.get(namespace, 'seedNativeMediaUsageCollectionDeletionPhases')(view)
      : new NativeMediaUsageCollectionDeletionPhases(f.storage.database, view as unknown as ConstructorParameters<typeof NativeMediaUsageCollectionDeletionPhases>[1]);
    expect(phases).toBeInstanceOf(NativeMediaUsageCollectionDeletionPhases);
    expect(await phases.processSources(stored)).toBe(false);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(queries.length).toBeGreaterThan(5);
    expect(new Set(queries).size).toBe(queries.length);
    expect(results).toEqual(queries);
    for (let index = 0; index < order.length; index += 2) {
      expect(order[index + 1]).toBe(order[index].replace(':first', ':second'));
    }
    const row = (await sql`SELECT phase,state,lease_token FROM _cms_media_usage_collection_deletions WHERE collection_id='actual-cleanup'`.execute(f.storage.database.db)).rows[0];
    expect(row).toEqual({ phase: 'status', state: 'leased', lease_token: stored.leaseToken });
    expect((await sql`SELECT token FROM _cms_guards`.execute(f.storage.database.db)).rows).toEqual([]);
    expect(Reflect.ownKeys(phases)).toEqual([]);
  } finally { batch.mockRestore(); }
}
for (const target of ['Node', 'D1'] as const) {
  it(`${target}: actual named class rejects a different existing owner before execution`, async () => {
    const f = await fixture(target), other = await fixture(target);
    const batch = vi.spyOn(f.storage.database, 'atomicBatch');
    try {
      expect(() => new NativeMediaUsageCollectionDeletionPhases(f.storage.database, other.view as unknown as ConstructorParameters<typeof NativeMediaUsageCollectionDeletionPhases>[1])).toThrow('exact registered CMS owner');
      expect(batch).not.toHaveBeenCalled();
    } finally { batch.mockRestore(); await other.storage.close(); await f.storage.close(); }
  }, 30000);
  it(`${target}: actual public class checkpoints its stored phase and observes every real receipt once`, async () => {
    const f = await fixture(target);
    try { await observedPhase(f, false); } finally { await f.storage.close(); }
  }, 30000);
  it(`${target}: named factory refuses an unknown actual query handle`, async () => {
    const f = await fixture(target);
    const batch = vi.spyOn(f.storage.database, 'atomicBatch');
    try {
      await expect(Promise.resolve().then(() => Reflect.get(namespace, 'seedNativeMediaUsageCollectionDeletionPhases')(f.storage.database.db as unknown as Parameters<typeof namespace.seedNativeMediaUsageCollectionDeletionPhases>[0]))).rejects.toThrow('actual registered query handle');
      expect(batch).not.toHaveBeenCalled();
    } finally { batch.mockRestore(); await f.storage.close(); }
  }, 30000);
  it(`${target}: named factory reuses the trusted original owner with genuine once-only receipts`, async () => {
    const f = await fixture(target);
    try { await observedPhase(f, true); } finally { await f.storage.close(); }
  }, 30000);
}
it('invokes the actual named factory in unchanged direct Node24 hosting', () => {
  const script = "import{openSqlite}from'./src/lib/server/database/sqlite.ts';import{migrateCms}from'./src/lib/server/database/migrations.ts';import*as namespace from'./src/lib/server/seed/namespace.ts';const database=openSqlite(':memory:');try{await migrateCms(database);const view=namespace.seedSourceDatabase(database);const phases=await namespace.seedNativeMediaUsageCollectionDeletionPhases(view);console.log(typeof phases.processSources);}finally{await database.close();}";
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: process.cwd(), encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout.trim()).toBe('function');
});
