import type { Kysely } from 'kysely';
import { handleMediaDelete as canonicalMediaDelete } from '../general-media/upstream/api/handlers/media.ts';
import { generalMediaDatabase } from '../general-media/storage.ts';
import { pluginDatabaseOwner } from './database.ts';
import type { Database } from './database-types.ts';
import type { Storage } from './storage-types.ts';
export function handleMediaDelete(db: Kysely<Database>, id: string, storage?: Storage) {
  return canonicalMediaDelete(generalMediaDatabase(pluginDatabaseOwner(db)), id, storage);
}
