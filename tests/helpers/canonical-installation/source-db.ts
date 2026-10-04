import { describe } from 'vitest';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { canonicalSourceDatabase } from '../../../src/lib/server/canonical-storage/namespace.ts';
import type { Kysely } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import type { Database } from '../../../src/lib/server/canonical-storage/types.ts';

const owners = new WeakMap<Kysely<Database>, CmsDatabase>();
export interface DialectTestContext { db: Kysely<Database>; dialect: 'sqlite' }
export function describeEachDialect(name: string, run: (dialect: 'sqlite') => void): void {
  describe(`${name} [native normal Node SQLite installation]`, () => run('sqlite'));
}
export async function setupForDialect(dialect: 'sqlite'): Promise<DialectTestContext> {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const db = canonicalSourceDatabase(database);
    owners.set(db, database);
    return { db, dialect };
  } catch (cause) { await database.close(); throw cause; }
}
export async function teardownForDialect(context: DialectTestContext | undefined): Promise<void> {
  if (context) await owners.get(context.db)?.close();
}
