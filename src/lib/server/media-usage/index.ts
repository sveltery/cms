import type { Kysely } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from '../blocks/upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../blocks/upstream/host.ts';
import * as progress from './upstream/api/handlers/media-usage-progress.ts';
import * as operators from './upstream/api/handlers/media-usage-work.ts';
import { runMediaUsageMaintenanceStep,finishMediaUsageCollectionDeletion } from './upstream/media/usage/maintenance-engine.ts';
import { processDueMediaUsageWork,processMediaUsageWorkAfterWrite } from './upstream/media/usage/work-processor.ts';
import { processDueMediaUsageReconciliationDetailed } from './upstream/media/usage/reconciliation-processor.ts';
import { processDueMediaUsageCollectionDeletions } from './upstream/media/usage/collection-deletion-processor.ts';
import { deleteActivatedMediaUsageCollection } from './upstream/media/usage/collection-deletion.ts';
import { cleanupGeneralMediaUsage } from '../general-media/usage-cleanup.ts';
import { refreshContentUsageAfterSuccessfulWrite,deleteContentUsageAfterSuccessfulPermanentDelete } from './upstream/write-usage.ts';

type Arguments<F extends (...args:any[])=>unknown>=Parameters<F> extends [unknown,...infer A]?A:never;
/** Finite product facade on the existing trusted physical owner. */
function database(owner:CmsDatabase):Kysely<Database> {
  registerBlockDatabaseHost(owner);
  return owner.db as unknown as Kysely<Database>;
}
export function handleMediaUsageProgress(owner:CmsDatabase) {
  return progress.handleMediaUsageProgress(database(owner));
}
export function handleMediaUsageProgressAdvance(owner:CmsDatabase) {
  return progress.handleMediaUsageProgressAdvance(database(owner));
}
export function handleMediaUsageRepair(owner:CmsDatabase,...args:Arguments<typeof progress.handleMediaUsageRepair>) {
  return progress.handleMediaUsageRepair(database(owner),...args);
}
export function handleMediaUsageWorkList(owner:CmsDatabase,...args:Arguments<typeof operators.handleMediaUsageWorkList>) {
  return operators.handleMediaUsageWorkList(database(owner),...args);
}
export function handleMediaUsageWorkRetry(owner:CmsDatabase,...args:Arguments<typeof operators.handleMediaUsageWorkRetry>) {
  return operators.handleMediaUsageWorkRetry(database(owner),...args);
}
export function handleMediaUsageCollectionDeletionList(owner:CmsDatabase,...args:Arguments<typeof operators.handleMediaUsageCollectionDeletionList>) {
  return operators.handleMediaUsageCollectionDeletionList(database(owner),...args);
}
export function handleMediaUsageCollectionDeletionRetry(owner:CmsDatabase,...args:Arguments<typeof operators.handleMediaUsageCollectionDeletionRetry>) {
  return operators.handleMediaUsageCollectionDeletionRetry(database(owner),...args);
}
export function runNativeMediaUsageMaintenanceStep(owner:CmsDatabase) {
  return runMediaUsageMaintenanceStep(database(owner));
}
export function processNativeDueMediaUsageWork(owner:CmsDatabase) {
  return processDueMediaUsageWork(database(owner));
}
export function processNativeMediaUsageWorkAfterWrite(owner:CmsDatabase,collectionSlug:string,contentId:string) {
  return processMediaUsageWorkAfterWrite(database(owner),collectionSlug,contentId);
}
export function refreshNativeContentUsageAfterSuccessfulWrite(owner:CmsDatabase,collection:string,contentIds:readonly string[]):Promise<void> {
  return refreshContentUsageAfterSuccessfulWrite(database(owner),collection,contentIds);
}
export function deleteNativeContentUsageAfterSuccessfulPermanentDelete(owner:CmsDatabase,collection:string,contentId:string):Promise<void> {
  return deleteContentUsageAfterSuccessfulPermanentDelete(database(owner),collection,contentId);
}
export function processNativeDueMediaUsageReconciliation(owner:CmsDatabase) {
  return processDueMediaUsageReconciliationDetailed(database(owner));
}
export function processNativeDueMediaUsageCollectionDeletions(owner:CmsDatabase) {
  return processDueMediaUsageCollectionDeletions(database(owner));
}
export function deleteNativeActivatedMediaUsageCollection(owner:CmsDatabase,...args:Arguments<typeof deleteActivatedMediaUsageCollection>) {
  return deleteActivatedMediaUsageCollection(database(owner),...args);
}
export function finishNativeMediaUsageCollectionDeletion(owner:CmsDatabase,collectionSlug:string) {
  return finishMediaUsageCollectionDeletion(database(owner),collectionSlug);
}
/** The exact Source mediaUsage system-cleanup slot. The host invokes this in
 * its full scheduled ordering; progress maintenance is driven by progress POST. */
export async function runMediaUsageSystemCleanup(owner:CmsDatabase):Promise<{mediaUsage:number}> {
  let mediaUsage=-1;
  try {
    const result=await cleanupGeneralMediaUsage(owner);
    mediaUsage=result.status==='failed'?-1:result.deletedRows;
  }catch(error){console.error('[cleanup] Failed to clean media usage:',error);}
  return {mediaUsage};
}
export type * from './upstream/api/schemas/media-usage.ts';
