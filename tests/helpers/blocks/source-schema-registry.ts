import type { Kysely } from 'kysely';
import type { Database } from '../../../src/lib/server/blocks/upstream/database/types.ts';
import { SchemaRegistry as NativeSchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { ownerFor } from './source-db.ts';
export { SchemaError } from '../../../src/lib/server/blocks/upstream/schema/registry.ts';
/** Test-only Source constructor bridge to actual native persisted collection creation. */
export class SchemaRegistry {
  private registry: NativeSchemaRegistry;
  constructor(db: Kysely<Database>) { this.registry = new NativeSchemaRegistry(ownerFor(db)); }
  async createCollection(input: unknown) { return this.registry.createCollection(input); }
}
