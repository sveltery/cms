import { AsyncLocalStorage } from 'node:async_hooks';
import type { Kysely } from 'kysely';
import type { Database } from './database/types.ts';

export const commentRequestScope = new AsyncLocalStorage<{
  database: Kysely<Database>;
  cache: Map<string, Promise<unknown>>;
}>();
export async function getDb(): Promise<Kysely<Database>> {
  const scope = commentRequestScope.getStore();
  if (!scope) throw new Error('Comments request database is unavailable');
  return scope.database;
}
export function runWithCommentDatabase<T>(database: Kysely<Database>, run: () => T): T {
  return commentRequestScope.run({ database, cache: new Map() }, run);
}
