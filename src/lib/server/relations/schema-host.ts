import type { Kysely } from 'kysely';
import { SchemaRegistry as NativeSchemaRegistry } from '../database/registry.ts';
import { requireRelationDatabase } from './storage.ts';

/** Source constructor transport to the sole actual native registry. */
export class SchemaRegistry {
  private readonly registry: NativeSchemaRegistry;
  constructor(db: Kysely<any>) { this.registry = new NativeSchemaRegistry(requireRelationDatabase(db)); }
  getCollection(slug: string) { return this.registry.getCollection(slug); }
  getCollectionWithFields(slug: string) { return this.registry.getCollectionWithFields(slug); }
  getField(collection: string, field: string) { return this.registry.getField(collection, field); }
}
