// The complete Source callbacks construct one real Kysely/SQLite database.
// This adapter only supplies the existing Native CmsDatabase constructor interface.
import type { Kysely, QueryResult } from 'kysely';
import type { CmsDatabase, CmsTables } from '../../../src/lib/server/database/contract.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeSchemaRegistry } from '../../../src/lib/server/database/registry.ts';
export { CmsError as SchemaError } from '../../../src/lib/server/database/contract.ts';
export type { CmsTables as Database } from '../../../src/lib/server/database/contract.ts';
const databases = new WeakMap<Kysely<CmsTables>, CmsDatabase>();
function nativeDatabase(db: Kysely<CmsTables>): CmsDatabase {
  let database = databases.get(db);
  if (database) return database;
  database = {
    db,
    async atomicBatch(statements) {
      return db.transaction().execute(async transaction => {
        const results: QueryResult<unknown>[] = [];
        for (const statement of statements) results.push(await transaction.executeQuery(statement));
        return results;
      });
    },
    close: () => db.destroy()
  };
  databases.set(db, database);
  return database;
}
export async function runMigrations(db: Kysely<CmsTables>) {
  await migrateCms(nativeDatabase(db));
}
export class SchemaRegistry extends NativeSchemaRegistry {
  constructor(db: Kysely<CmsTables>) { super(nativeDatabase(db)); }
}
