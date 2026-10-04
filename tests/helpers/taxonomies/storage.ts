import type { Kysely, QueryResult } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

const owners = new WeakMap<object,CmsDatabase>();
/** Dedicated Node fixture only. Every statement executes on the supplied real
 * Kysely connection in a real SQLite transaction; no synthesized results. */
export function fixtureStorage(db: Kysely<any>): CmsDatabase {
  let owner=owners.get(db);
  if(!owner) {
    owner={db:db as CmsDatabase['db'],
      atomicBatch: statements => db.transaction().execute(async transaction => {
        const results: QueryResult<unknown>[]=[];
        for(const statement of statements) results.push(await transaction.executeQuery(statement));
        return results;
      }),
      close: () => db.destroy()};
    owners.set(db,owner);
  }
  return owner;
}
