import type { Kysely } from 'kysely';
import { RevisionRepository as CanonicalRevisionRepository } from '../database/lifecycle/upstream/database/repositories/revision.ts';
import type { DatetimeContextCache } from '../database/lifecycle/upstream/database/content-datetime.ts';
import type { Database as CanonicalDatabase } from '../database/lifecycle/upstream/database/types.ts';
import type { Database } from './database-types.ts';
import { pluginDatabaseOwner } from './database.ts';
export { normalizeRevisionLimit } from '../database/lifecycle/upstream/database/repositories/revision.ts';

/** A genuine transaction descriptor already holds that exact transaction db. */
export class RevisionRepository extends CanonicalRevisionRepository {
  constructor(db: Kysely<Database>, datetimeContexts?: DatetimeContextCache) {
    const owner = pluginDatabaseOwner(db);
    super(owner.db as unknown as Kysely<CanonicalDatabase>, datetimeContexts);
  }
}
