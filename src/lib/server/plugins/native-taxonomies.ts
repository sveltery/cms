import type { Kysely } from 'kysely';
import { canonicalSourceDatabase } from '../canonical-storage/namespace.ts';
import { TaxonomyRepository as CanonicalTaxonomyRepository } from '../taxonomies/repository.ts';
import { pluginDatabaseOwner } from './database.ts';
import type { Database } from './database-types.ts';
export class TaxonomyRepository extends CanonicalTaxonomyRepository {
  constructor(db: Kysely<Database>) { super(canonicalSourceDatabase(pluginDatabaseOwner(db))); }
}
export type { Taxonomy } from '../taxonomies/repository.ts';
