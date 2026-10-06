// Reuse the sole published usage algorithm and executor; no second write owner.
import { MediaUsageRepository as PublishedRepository } from '../../../../blocks/upstream/database/repositories/media-usage.ts';
import type { Database as PublishedDatabase } from '../../../../blocks/upstream/database/types.ts';
import type { Database } from '../types.ts';
import type { Kysely } from 'kysely';
export type * from '../../../../blocks/upstream/database/repositories/media-usage.ts';
export class MediaUsageRepository extends PublishedRepository {
  constructor(db:Kysely<Database>){super(db as unknown as Kysely<PublishedDatabase>);}
}
