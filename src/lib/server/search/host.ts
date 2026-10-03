import type { Kysely } from 'kysely';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';
/** Public helpers use the real request's configured database, never a global identity. */
export async function getDb(): Promise<Kysely<Database>> {
  const { getRequestEvent } = await import('$app/server');
  const database = getRequestEvent().locals.cms?.database;
  if (!database) throw new Error('Content storage is not configured');
  return database.db as unknown as Kysely<Database>;
}
