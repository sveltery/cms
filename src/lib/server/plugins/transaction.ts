import type { Kysely, Transaction } from 'kysely';
import { registeredPluginDatabaseOwner, assertRegisteredPluginNamespace, executePluginTransaction } from './database.ts';
import { withTransaction as sourceTransaction } from '../database/lifecycle/upstream/database/transaction.ts';
/** Preserve C-07 on actual storage; Source controlled fixtures keep their original transaction helper. */
export async function withTransaction<DB, T>(db: Kysely<DB>, fn: (trx: Kysely<DB> | Transaction<DB>) => Promise<T>): Promise<T> {
  assertRegisteredPluginNamespace(db);
  if (db.isTransaction) return fn(db);
  const owner = registeredPluginDatabaseOwner(db);
  if (!owner) return sourceTransaction(db, fn);
  if (!owner.atomicQueryLoops) throw new Error('D1 plugin compound writes require the named canonical atomic batch producer');
  return executePluginTransaction(db, fn);
}
