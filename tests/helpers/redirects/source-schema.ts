import { SchemaRegistry as NativeSchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { redirectFixtureStorage } from './test-db.ts';

// Source-shaped constructor transport to the actual native storage registry.
// No fixture rows, schema defaults or success responses are manufactured.
export class SchemaRegistry {
  private readonly registry: NativeSchemaRegistry;
  constructor(db: object) { this.registry = new NativeSchemaRegistry(redirectFixtureStorage(db)); }
  createCollection(input: unknown) { return this.registry.createCollection(input); }
  createField(collection: unknown, input: unknown) { return this.registry.createField(collection, input); }
}
