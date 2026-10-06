import type { Kysely } from 'kysely';
import { ContentRepository as CanonicalContentRepository } from '../database/lifecycle/upstream/database/repositories/content.ts';
import type { DatetimeContextCache } from '../database/lifecycle/upstream/database/content-datetime.ts';
import type { Database as CanonicalDatabase } from '../database/lifecycle/upstream/database/types.ts';
import type { Database } from './database-types.ts';
import { pluginDatabaseOwner } from './database.ts';

/** Delegate every method to the sole existing class on its current owner executor. */
export class ContentRepository extends CanonicalContentRepository {
  constructor(db: Kysely<Database>, datetimeContexts?: DatetimeContextCache) {
    const owner = pluginDatabaseOwner(db);
    super(owner.db as unknown as Kysely<CanonicalDatabase>, datetimeContexts);
  }
}
