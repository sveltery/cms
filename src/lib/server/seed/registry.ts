import type { Kysely } from 'kysely';
import { SchemaRegistry as NativeSchemaRegistry } from '../database/registry.ts';
import { seedDatabaseOwner } from './namespace.ts';
export { SchemaError } from './schema-error.ts';

/** Trusted Source constructor transport to the sole canonical schema writer. */
export class SchemaRegistry extends NativeSchemaRegistry {
  constructor(db: Kysely<any>) { super(seedDatabaseOwner(db)); }
  createSeedCollection(input: unknown, fields: readonly unknown[]): Promise<void> {
    return this.createSeedCollectionSchema(input, fields);
  }
}
