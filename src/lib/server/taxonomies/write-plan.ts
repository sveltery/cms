import type { Compilable, CompiledQuery, Kysely, QueryResult, RawBuilder } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from '../canonical-storage/types.ts';
import { withTransaction } from '../menus/transaction.ts';

/** A synchronous fixed query-list producer, never a transaction emulation. */
export type TaxonomyWritePlan = (db: Kysely<Database>) => readonly (Compilable | RawBuilder<unknown>)[];
type Host = { storage: CmsDatabase; compile: (storage: CmsDatabase, plan: TaxonomyWritePlan) => readonly CompiledQuery[] };
const hosts = new WeakMap<object, Host>();
/** Registered solely by the existing actual canonical database owner. */
export function registerTaxonomyWriteHost(db: object, storage: CmsDatabase, compile: Host['compile']): void {
  hosts.set(db, { storage, compile });
}
export async function executeTaxonomyWritePlan(db: Kysely<Database>, plan: TaxonomyWritePlan): Promise<readonly QueryResult<unknown>[]> {
  const host = hosts.get(db);
  if (host) return host.storage.atomicBatch(host.compile(host.storage, plan));
  // Ordinary Source/Node callers retain a real transaction. Unsupported D1
  // still fails at the existing transaction seam when no actual host is registered.
  return withTransaction(db, async transaction => {
    const queries = plan(transaction);
    const compiled = queries.map(query => 'isRawBuilder' in query ? query.compile(transaction) : query.compile());
    const results: QueryResult<unknown>[] = [];
    for (const query of compiled) results.push(await transaction.executeQuery(query));
    return results;
  });
}

/** Actual owner lookup for Source-shaped constructor hosting. */
export function taxonomyStorage(db: object): CmsDatabase {
  const host=hosts.get(db);
  if(!host)throw new Error('Taxonomy database has no registered storage owner');
  return host.storage;
}
