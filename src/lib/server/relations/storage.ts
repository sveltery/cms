import type { Kysely } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';

const owners = new WeakMap<object, CmsDatabase>();
/** Trusted owner registration; no connection, migration or identity creation. */
export function registerRelationDatabase(database: CmsDatabase, query: object = database.db): void {
  owners.set(database.db, database);
  owners.set(query, database);
}
export function relationDatabase(query: object): CmsDatabase | undefined { return owners.get(query); }
export function requireRelationDatabase(query: Kysely<any>): CmsDatabase {
  const database = relationDatabase(query);
  if (!database) throw new Error('Relations require their existing trusted canonical database owner');
  return database;
}
