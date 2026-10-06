import type { Kysely } from 'kysely';
import { markContentMediaUsageCollectionStaleSafely as canonicalMarkCollectionStale } from '../blocks/upstream/media/usage/schema-invalidation.ts';
import { registerBlockDatabaseHost } from '../blocks/upstream/host.ts';
import { pluginDatabaseOwner } from './database.ts';
import type { Database } from './database-types.ts';
/** Calls the existing canonical block/media-usage writer with its actual owner. */
export function markContentMediaUsageCollectionStaleSafely(db: Kysely<Database>, collection: string, code: string) {
  const database = pluginDatabaseOwner(db);
  registerBlockDatabaseHost(database);
  return canonicalMarkCollectionStale(database.db as Parameters<typeof canonicalMarkCollectionStale>[0], collection, code);
}
