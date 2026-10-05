import type { Kysely } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { seedSourceDatabase } from '../../../src/lib/server/seed/namespace.ts';
import type { Database } from '../../../src/lib/server/seed/upstream/database/types.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { describe } from 'vitest';

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
export interface DialectTestContext { db: Kysely<Database>; dialect: 'sqlite' }
/** PostgreSQL is unavailable; retain Source's ordinary SQLite registration. */
export function describeEachDialect(name: string, fn: (dialect: 'sqlite') => void): void {
  describe(`${name} [sqlite]`, () => fn('sqlite'));
}
export async function setupForDialect(dialect: 'sqlite'): Promise<DialectTestContext> {
  return { db: await setupTestDatabase(), dialect };
}
export async function teardownForDialect(ctx: DialectTestContext | undefined): Promise<void> {
  if (ctx) await teardownTestDatabase(ctx.db);
}
