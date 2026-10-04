// Preserve the actual public C-07 boundary for this registered block host too.
import type { Kysely, Transaction } from 'kysely';
import { withTransaction as publicWithTransaction } from '../../../database/lifecycle/upstream/database/transaction.ts';
import { blockDatabaseHost } from '../host.ts';
export async function withTransaction<DB,T>(db: Kysely<DB>, fn: (trx: Kysely<DB> | Transaction<DB>) => Promise<T>): Promise<T> {
  if (blockDatabaseHost(db) && !db.isTransaction) return db.transaction().execute(fn);
  return publicWithTransaction(db,fn);
}
