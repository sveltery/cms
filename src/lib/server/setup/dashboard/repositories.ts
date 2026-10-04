// Constructor schema views over the same actual registered Kysely object.
// Complete public repository bodies stay inherited; no SQL/value/provider substitution.
import type { Kysely } from 'kysely';
import { ContentRepository as NativeContentRepository }
  from '../../database/lifecycle/upstream/database/repositories/content.ts';
import { OptionsRepository as NativeOptionsRepository } from '../../options/repository.ts';
import type { Database as NativeLifecycleDatabase }
  from '../../database/lifecycle/upstream/database/types.ts';
import type { Database as CanonicalDatabase } from '../../canonical-storage/types.ts';
import type { Database } from './database-types.ts';

/** Kysely generics are invariant despite equivalent persisted names at this seam. */
export class ContentRepository extends NativeContentRepository {
  constructor(db: Kysely<Database>) {
    super(db as unknown as Kysely<NativeLifecycleDatabase>);
  }
}
export class OptionsRepository extends NativeOptionsRepository {
  constructor(db: Kysely<Database>) {
    super(db as unknown as Kysely<CanonicalDatabase>);
  }
}
