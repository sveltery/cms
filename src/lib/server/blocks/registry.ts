import type { CmsDatabase } from '../database/contract.ts';
import { BlockTypeRegistry } from './upstream/schema/block-type-registry.ts';
import type { Database } from './upstream/database/types.ts';
import { registerBlockDatabaseHost } from './upstream/host.ts';

export { BlockTypeRegistry } from './upstream/schema/block-type-registry.ts';
export { canonicalBlockFields, compareBlockFields, fingerprintBlockFields, validateBlockFields } from './upstream/schema/block-type-contract.ts';
export { resolveBlockTypes, normalizeBlocksData, expandCollectionBlockFields } from './upstream/schema/block-values.ts';
export { SchemaError } from './upstream/schema/registry.ts';
export type * from './upstream/schema/block-types.ts';

/** Trusted storage injection; all writes use the actual CmsDatabase atomic implementation. */
export function createBlockTypeRegistry(database: CmsDatabase): BlockTypeRegistry {
  registerBlockDatabaseHost(database);
  return new BlockTypeRegistry(database.db as unknown as import('kysely').Kysely<Database>);
}
