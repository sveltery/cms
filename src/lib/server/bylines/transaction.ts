import type { Kysely, Transaction } from 'kysely';
import type { Database } from './database-types.ts';
import { bylineDatabaseOwner } from './storage.ts';
/** No Source D1 non-transactional fallback or synthetic successful writes. */
export async function withTransaction<T>(db:Kysely<Database>, run:(transaction:Kysely<Database>|Transaction<Database>)=>Promise<T>):Promise<T> {
  if (db.isTransaction) return run(db);
  bylineDatabaseOwner(db);
  return db.transaction().execute(run);
}
