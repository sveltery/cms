import type { Kysely } from 'kysely';
import { SchemaRegistry as CanonicalSchemaRegistry } from '../database/registry.ts';
import type { Database } from './database-types.ts';
import { pluginDatabaseOwner } from './database.ts';
export class SchemaRegistry extends CanonicalSchemaRegistry {
  constructor(db: Kysely<Database>) { super(pluginDatabaseOwner(db)); }
}
