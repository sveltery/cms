import type { Kysely, Transaction } from 'kysely';
// Preserve the native C-07 requirement: no unsupported-transaction fallback.
export function withTransaction<DB, T>(db: Kysely<DB>, run: (db: Kysely<DB> | Transaction<DB>) => Promise<T>): Promise<T> {
  return db.isTransaction ? run(db) : db.transaction().execute(run);
}
