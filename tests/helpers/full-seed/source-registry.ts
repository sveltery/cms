import { SchemaRegistry as ProductionRegistry } from '../../../src/lib/server/seed/registry.ts';
import { fixtureProductionHandle } from './source-d1-fixture-handle.ts';
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/lib/server/seed/upstream/database/types.ts';
/** Actual production registry on the matching guarded owner; fixture transport only. */
export class SchemaRegistry extends ProductionRegistry {
  constructor(db: Kysely<Database>) { super(fixtureProductionHandle(db)); }
}
