import type { Kysely } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { seedSourceDatabase } from '../../../src/lib/server/seed/namespace.ts';
import type { Database } from '../../../src/lib/server/seed/upstream/database/types.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

const owners = new WeakMap<object, CmsDatabase>();
export function sourceSeedOwner(db: object): CmsDatabase {
  const owner = owners.get(db);
  if (!owner) throw new Error('Seed fixture requires its actual registered storage owner');
  return owner;
}
export async function setupTestDatabase(): Promise<Kysely<Database>> {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const db = seedSourceDatabase(database) as Kysely<Database>;
    owners.set(db, database);
    return db;
  } catch (cause) { await database.close(); throw cause; }
}
export async function teardownTestDatabase(db: Kysely<Database>): Promise<void> {
  await sourceSeedOwner(db).close();
}
