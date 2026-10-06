import type { Kysely } from 'kysely';
import { openD1 } from '../../../src/lib/server/database/d1.ts';
import { asyncD1Storage } from '../async-d1-storage.ts';
declare const __SEED_TEST_STORAGE__: string;
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { seedSourceDatabase } from '../../../src/lib/server/seed/namespace.ts';
import type { Database } from '../../../src/lib/server/seed/upstream/database/types.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { describe } from 'vitest';
import { originalD1FixtureHandle } from './source-d1-fixture-handle.ts';

const owners = new WeakMap<object, CmsDatabase>();
export function sourceSeedOwner(db: object): CmsDatabase {
  const owner = owners.get(db);
  if (!owner) throw new Error('Seed fixture requires its actual registered storage owner');
  return owner;
}
export async function setupTestDatabase(): Promise<Kysely<Database>> {
  let database:CmsDatabase;
  if(typeof __SEED_TEST_STORAGE__!=='undefined' && __SEED_TEST_STORAGE__==='raw-d1') {
    const fixture=await asyncD1Storage();const storage=openD1(fixture.binding);
    database={...storage,async close(){try{await storage.close();}finally{await fixture.runtime.dispose();}}};
  } else database=openSqlite(':memory:');
  try {
    await migrateCms(database);
    const guarded = seedSourceDatabase(database) as Kysely<Database>;
    const db = database.atomicQueryLoops ? guarded : originalD1FixtureHandle(guarded,database);
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
