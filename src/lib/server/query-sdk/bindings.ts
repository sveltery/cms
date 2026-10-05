import type { CmsDatabase } from '../database/contract.ts';
import { lifecycleDatabase } from '../database/lifecycle/upstream/host.ts';

// Explicit trusted Native constructor bindings. This owns no SQL connection,
// migrations, request cache or persisted state.
const databases = new WeakMap<object, CmsDatabase>();

export function bindQueryDatabase(database: CmsDatabase): void {
  databases.set(database.db, database);
}

export function queryDatabaseOwner(db: object): CmsDatabase {
  const database = databases.get(db) ?? lifecycleDatabase(db);
  if (!database) throw new Error('Query database has no trusted CmsDatabase owner');
  return database;
}
