import type { Kysely } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import type { Database } from '../../../src/lib/server/canonical-storage/types.ts';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { canonicalSourceDatabase } from '../../../src/lib/server/canonical-storage/namespace.ts';

const owners = new WeakMap<Kysely<Database>, CmsDatabase>();
/** Test-only ordinary setup: actual native migrations, no auth/session provisioning. */
export async function setupTestDatabase(): Promise<Kysely<Database>> {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const db = canonicalSourceDatabase(database);
    owners.set(db, database);
    return db;
  } catch (cause) { await database.close(); throw cause; }
}
export async function teardownTestDatabase(db: Kysely<Database>): Promise<void> {
  await owners.get(db)?.close();
}
