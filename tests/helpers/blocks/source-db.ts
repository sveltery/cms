import { describe } from 'vitest';
import type { Kysely } from 'kysely';
import { RawBindingD1Adapter, openD1 } from '../../../src/lib/server/database/d1.ts';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import type { CmsDatabase, CmsTables } from '../../../src/lib/server/database/contract.ts';
import type { Database } from '../../../src/lib/server/blocks/upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../../../src/lib/server/blocks/upstream/host.ts';
import { clearSchemaCache } from '../../../src/lib/server/schema/zod-generator.ts';
import { asyncD1Storage } from '../async-d1-storage.ts';
import { sourceBlockNamespace } from './source-namespace.ts';

type Dialect = 'sqlite' | 'raw-d1';
const owners = new WeakMap<object,CmsDatabase>();
const disposers = new WeakMap<object,() => Promise<void>>();
export interface DialectTestContext { db: Kysely<Database>; dialect: Dialect }
export function describeEachDialect(name: string, run: (dialect: Dialect) => void): void {
  describe(name + ' [ordinary Native Node SQLite]', () => run('sqlite'));
  describe(name + ' [additional ordinary Native raw D1 expansion]', () => run('raw-d1'));
}
export function ownerFor(db: Kysely<Database>): CmsDatabase {
  const known = owners.get(db);
  if (known) return known;
  const adapter = db.getExecutor().adapter;
  if (!(adapter instanceof RawBindingD1Adapter)) throw new Error('Block Source fixture has no actual storage owner');
  const database: CmsDatabase = { db:db as unknown as Kysely<CmsTables>,
    async atomicBatch(queries) { return adapter.executeAtomicBatch(queries); },
    async close() { await db.destroy(); } };
  owners.set(db,database);registerBlockDatabaseHost(database);
  return database;
}
export async function createForDialect(dialect: Dialect): Promise<DialectTestContext> {
  clearSchemaCache();
  const storage = dialect === 'raw-d1' ? await asyncD1Storage() : undefined;
  const database = storage ? openD1(storage.binding) : openSqlite(':memory:');
  const db = database.db.withPlugin(sourceBlockNamespace) as unknown as Kysely<Database>;
  const sourceDatabase: CmsDatabase = {...database,db:db as unknown as Kysely<CmsTables>};
  owners.set(db,database);registerBlockDatabaseHost(sourceDatabase);
  disposers.set(db,async () => { await database.close(); await storage?.runtime.dispose(); });
  return {db,dialect};
}
export async function runMigrations(db: Kysely<Database>): Promise<void> { await migrateCms(ownerFor(db)); }
export async function runMigrationsForDialect(ctx: DialectTestContext): Promise<void> { await runMigrations(ctx.db); }
export async function setupForDialect(dialect: Dialect): Promise<DialectTestContext> {
  const ctx = await createForDialect(dialect);
  try { await runMigrations(ctx.db);return ctx; }
  catch(error) { await teardownForDialect(ctx);throw error; }
}
export async function teardownForDialect(ctx: DialectTestContext | undefined): Promise<void> {
  if(ctx) await disposers.get(ctx.db)?.();
}
