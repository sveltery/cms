import type { CompiledQuery, Kysely, QueryResult } from 'kysely';

/** Use the current request's real adapter, preserving its connection scope. */
export function menuAtomicBatch<DB>(db: Kysely<DB>): ((statements: readonly CompiledQuery[]) => Promise<readonly QueryResult<unknown>[]>) | null {
  if (db.isTransaction) return null;
  const adapter = db.getExecutor().adapter;
  if (!('executeAtomicBatch' in adapter) || typeof adapter.executeAtomicBatch !== 'function') return null;
  const execute = adapter.executeAtomicBatch.bind(adapter) as (statements: readonly CompiledQuery[]) => Promise<readonly QueryResult<unknown>[]>;
  return statements => db.connection().execute(() => execute(statements));
}
