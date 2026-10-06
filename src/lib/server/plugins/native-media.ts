import type { Kysely } from 'kysely';
import { MediaRepository as CanonicalMediaRepository } from '../general-media/index.ts';
import type { Database } from './database-types.ts';
import { pluginDatabaseOwner } from './database.ts';
export class MediaRepository extends CanonicalMediaRepository {
  constructor(db: Kysely<Database>) { super(pluginDatabaseOwner(db)); }
}
export type { MediaItem } from '../general-media/upstream/database/repositories/media.ts';
