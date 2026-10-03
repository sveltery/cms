import { SchemaRegistry as NativeSchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/lib/server/menus/database-types.ts';
import { fixtureStorage } from './test-db.ts';

/** Source constructor shape around the actual native collection/field service. */
export class SchemaRegistry {
  private readonly registry: NativeSchemaRegistry;
  constructor(db: Kysely<Database>) { this.registry = new NativeSchemaRegistry(fixtureStorage(db)); }
  createCollection(input: unknown) { return this.registry.createCollection(input); }
  createField(collection: unknown, input: unknown) { return this.registry.createField(collection, input); }
}
