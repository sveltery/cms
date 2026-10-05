import type {CmsDatabase} from '../database/contract.ts';
import type {Kysely} from 'kysely';
import type {MediaUsageCleanupTable} from '../blocks/upstream/database/types.ts';
import {generalMediaDatabase} from './storage.ts';
import {cleanupMediaUsage} from './upstream/media/usage/cleanup.ts';
export type {MediaUsageCleanupResult} from './upstream/media/usage/cleanup.ts';
/** Trusted bounded maintenance on the sole published usage owner; no cron or schema installer. */
export async function cleanupGeneralMediaUsage(database:CmsDatabase){
  const db=generalMediaDatabase(database);
  const metadata=db as unknown as Kysely<{_cms_media_usage_cleanup:MediaUsageCleanupTable}>;
  // Source migration061 initializes this row; canonical schema installation retains empty metadata.
  // Do not replace an existing owner, lease, cursor or backoff state.
  await metadata.insertInto('_cms_media_usage_cleanup')
    .values({task_key:'projection_gc',next_eligible_at:'1970-01-01T00:00:00.000Z'})
    .onConflict(conflict=>conflict.column('task_key').doNothing()).execute();
  return cleanupMediaUsage(db);
}
