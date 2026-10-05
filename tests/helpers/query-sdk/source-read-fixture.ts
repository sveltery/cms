// Genuine whole immutable Source constructors create this reference database.
// The fixture only supplies read-host metadata; it installs no Native provider.
import type {Kysely} from 'kysely';
import {SchemaRegistry as SourceRegistry} from '../../../parity/emdash/taxonomies/source/packages/core/src/schema/registry.ts';
import {runMigrations as migrateSource} from '../../../parity/emdash/taxonomies/source/packages/core/src/database/migrations/runner.ts';
import {bindSourceQueryReadHost} from '../../../src/lib/server/query-sdk/read-storage.ts';

export class SchemaRegistry extends SourceRegistry {
  constructor(database: ConstructorParameters<typeof SourceRegistry>[0]) {
    bindSourceQueryReadHost(database as unknown as Kysely<unknown>);
    super(database);
  }
}

export async function runMigrations(database: Parameters<typeof migrateSource>[0]) {
  bindSourceQueryReadHost(database as unknown as Kysely<unknown>);
  return migrateSource(database);
}
