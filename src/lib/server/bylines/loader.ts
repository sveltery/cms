import { getDb as getRequestDatabase } from '../menus/loader.ts';
import { bylineDatabase } from './storage.ts';
import type { Kysely } from 'kysely';
import type { Database } from './database-types.ts';
/** Reuse the sole trusted request context and loader; no new database/cache. */
export async function getDb():Promise<Kysely<Database>> {
  return bylineDatabase(await getRequestDatabase() as unknown as Kysely<Database>);
}
