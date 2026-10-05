import { sql, type Kysely } from 'kysely';
/** Source listTablesLike SQLite branch, querying the actual catalogue. */
export async function listTablesLike<DB>(db:Kysely<DB>, pattern:string):Promise<string[]> {
  const result=await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ${pattern}`.execute(db);
  return result.rows.map(row=>row.name);
}
