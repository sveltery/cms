// Genuine whole immutable Source constructors create this reference database.
// The fixture only supplies read-host metadata; it installs no Native provider.
import {SchemaRegistry as SourceRegistry} from '../../../parity/emdash/taxonomies/source/packages/core/src/schema/registry.ts';
import {runMigrations as migrateSource} from '../../../parity/emdash/taxonomies/source/packages/core/src/database/migrations/runner.ts';
import {bindSourceQueryReadHost} from '../../../src/lib/server/query-sdk/read-storage.ts';

export class SchemaRegistry extends SourceRegistry {
  constructor(database) {
    bindSourceQueryReadHost(database);
    super(database);
  }
}

export async function runMigrations(database) {
  bindSourceQueryReadHost(database);
  return migrateSource(database);
}
