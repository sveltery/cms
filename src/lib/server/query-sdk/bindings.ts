import type { CmsDatabase } from '../database/contract.ts';
import { lifecycleDatabase } from '../database/lifecycle/upstream/host.ts';
import { withCanonicalStorageNamespaces } from '../canonical-storage/namespace.ts';
import type { Kysely } from 'kysely';

// Explicit trusted Native constructor bindings. This owns no SQL connection,
// migrations, request cache or persisted state.
const databases = new WeakMap<object, CmsDatabase>();
const logicalReads = new WeakMap<object, ReturnType<typeof withCanonicalStorageNamespaces>>();

export function bindQueryDatabase(database: CmsDatabase): void {
  databases.set(database.db, database);
}

export function queryDatabaseOwner(db: object): CmsDatabase {
  const database = databases.get(db) ?? lifecycleDatabase(db);
  if (!database) throw new Error('Query database has no trusted CmsDatabase owner');
  return database;
}

export function queryReadDatabase(db: Kysely<unknown>) {
  const cached = logicalReads.get(db);
  if (cached) return cached;
  const database = databases.get(db) ?? lifecycleDatabase(db);
  // Preserve the supplied real executor and plugins, including failure/isolated
  // request views. Reads do not manufacture an atomic writer for an unowned DB.
  const logical = withCanonicalStorageNamespaces(db);
  if (database) databases.set(logical, {...database, db: logical as unknown as CmsDatabase['db']});
  logicalReads.set(db, logical);
  return logical;
}
