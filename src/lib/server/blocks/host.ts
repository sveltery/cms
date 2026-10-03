import type {Kysely} from 'kysely';
import {sql} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {registerLifecycleDatabase,lifecycleDatabase} from '../database/lifecycle/upstream/host.ts';
import {invalidateSchemaCache} from '../schema/zod-generator.ts';

export function blocksDatabase(database:CmsDatabase) {
  registerLifecycleDatabase(database);
  return database.db as unknown as Kysely<import('../media/source/database/types.ts').Database>;
}
// Block registry fixed lists always use the real native atomic batch. The
// source callback-transaction fallback is unavailable on native D1.
export async function withTransaction<T>(db:Kysely<any>,operation:(db:Kysely<any>)=>Promise<T>):Promise<T> {
  if(lifecycleDatabase(db))throw new Error('Unexpected block registry callback transaction on native host');
  return db.transaction().execute(operation);
}
export function refreshDevTypes() {
  // Native consumers regenerate through current registry manifests; there is
  // no Astro development type watcher in the SvelteKit application.
}
export async function invalidateContentMediaUsageSchemaChange(db:Kysely<any>,collection:string):Promise<boolean> {
  const exists=await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table' AND name='_cms_media_usage_activation'`.execute(db);
  if(!exists.rows.length)return false;
  const activation=await sql<{state:string}>`SELECT state FROM _cms_media_usage_activation WHERE task_key='incremental_capture'`.execute(db);
  if(activation.rows[0]?.state!=='active')return false;
  throw new Error(`Media usage schema invalidation for ${collection} requires the actual media usage provider`);
}
export async function markContentMediaUsageCollectionStaleSafely(db:Kysely<any>,collection:string,_code:string):Promise<boolean> {
  const exists=await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table' AND name='_cms_media_usage_activation'`.execute(db);
  if(!exists.rows.length)return false;
  throw new Error(`Media usage stale tracking for ${collection} requires the actual media usage provider`);
}
export {invalidateSchemaCache};
