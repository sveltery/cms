import type { Kysely } from 'kysely';
import { handleTermCreate as canonicalTermCreate } from '../taxonomies/handlers.ts';
import { canonicalSourceDatabase } from '../canonical-storage/namespace.ts';
import { pluginDatabaseOwner } from './database.ts';
import type { Database } from './database-types.ts';
export function handleTermCreate(db: Kysely<Database>, input: Parameters<typeof canonicalTermCreate>[1]) {
  return canonicalTermCreate(canonicalSourceDatabase(pluginDatabaseOwner(db)), input);
}
