import type {D1Binding} from '../database/d1.ts';
import {openD1} from '../database/d1.ts';
import {migrateCms} from '../database/migrations.ts';
import type {Database} from '../database/lifecycle/upstream/database/types.ts';
import {pruneQueuedRevisions} from './revisions.ts';
import type {ExecutionContext} from '@cloudflare/workers-types';
import type {Kysely} from 'kysely';

/** Supplied by the hosting owner, never from request parameters or headers. */
export type RevisionMaintenanceStorage =
  | {kind:'sqlite';path:string}
  | {kind:'d1';binding:D1Binding};
export interface RevisionMaintenanceResult {revisionsPruned:number}

async function openStorage(configuration: RevisionMaintenanceStorage) {
  if (configuration.kind === 'sqlite') {
    if (typeof configuration.path !== 'string' || !configuration.path.trim() ||
      configuration.path.includes('\0') || configuration.path === ':memory:') {
      throw new Error('Revision maintenance requires a persistent SQLite file');
    }
    const {openRuntimeSqlite} = await import('../runtime/node.ts');
    return openRuntimeSqlite(configuration.path);
  }
  if (configuration.kind === 'd1') {
    if (!configuration.binding || typeof configuration.binding.prepare !== 'function' ||
      typeof configuration.binding.batch !== 'function') {
      throw new Error('Revision maintenance requires a raw D1 database binding');
    }
    return openD1(configuration.binding);
  }
  throw new Error('Revision maintenance requires a supported storage configuration');
}

/**
 * Open trusted storage, validate canonical startup, consume one global batch,
 * and release the owned adapter. Other system cleanup subsystems are absent
 * from this result. A revision subsystem failure is -1, as in pinned cleanup;
 * invalid host configuration and migration failures propagate.
 */
export async function runRevisionMaintenance(configuration: RevisionMaintenanceStorage): Promise<RevisionMaintenanceResult> {
  const database = await openStorage(configuration);
  try {
    await migrateCms(database);
    try {
      return {revisionsPruned: await pruneQueuedRevisions(database.db as unknown as Kysely<Database>)};
    }catch(error) {
      console.error('[cleanup] Failed to prune revisions:',error);
      return {revisionsPruned:-1};
    }
  }finally{await database.close();}
}

/**
 * Host-owned Worker scheduled entry. Merge this scheduled method into an
 * operator's Worker wrapper; it registers no cron or anonymous HTTP route.
 * The actual execution context anchors the real maintenance promise.
 */
export function createRevisionMaintenanceScheduledHandler(bindingName='CMS_DB') {
  if(typeof bindingName!=='string'||!bindingName.trim())throw new Error('Revision maintenance binding name must be nonempty');
  return {
    scheduled(_controller:unknown,environment:Record<string,unknown>,context:Pick<ExecutionContext,'waitUntil'>):void {
      context.waitUntil(runRevisionMaintenance({kind:'d1',binding:environment[bindingName] as D1Binding}).then(()=>undefined));
    }
  };
}
