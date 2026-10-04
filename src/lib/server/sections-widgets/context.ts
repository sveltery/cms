import type { Kysely } from 'kysely';
import type { Database } from './database-types.ts';
import { getRequestContext, runWithContext } from './request-context.ts';
/** Explicit, request-scoped storage only. No configured singleton or implicit installer. */
export async function getDb(): Promise<Kysely<Database>> {
  const context = getRequestContext();
  if (!context?.db) throw new Error('Section/widget storage is unavailable outside its trusted request scope');
  return context.db as Kysely<Database>;
}
export function withSectionWidgetStorage<T>(db: Kysely<Database>, callback: () => T): T {
  return runWithContext({ editMode: false, db }, callback);
}
