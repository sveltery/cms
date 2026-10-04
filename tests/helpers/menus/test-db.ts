import { describe } from 'vitest';
import { SqliteDialect, sql, type Kysely as KyselyType } from 'kysely';
import { Kysely } from './source-kysely.ts';
import { openNodeSqliteDatabase } from '../../../src/lib/server/database/node-sqlite-compat.ts';
import { installHistoricalCanonical5 } from '../historical-canonical5.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import type { Database } from '../../../src/lib/server/menus/database-types.ts';
import { menuSchemaStatements } from '../../../src/lib/server/menus/migrations.ts';

const owners = new WeakMap<object, CmsDatabase>();
export function fixtureStorage(db: KyselyType<Database>): CmsDatabase {
  let storage = owners.get(db);
  if (!storage) {
    storage = {
      db: db as unknown as CmsDatabase['db'],
      atomicBatch: statements => db.transaction().execute(async transaction => {
        const results = [];
        for (const statement of statements) results.push(await transaction.executeQuery(statement));
        return results;
      }),
      close: () => db.destroy()
    };
    owners.set(db, storage);
  }
  return storage;
}
export function createDatabase(_options: { url: string }): KyselyType<Database> {
  return new Kysely<Database>({ dialect: new SqliteDialect({ database: openNodeSqliteDatabase(':memory:') }) });
}
export async function runMigrations(db: KyselyType<Database>): Promise<void> {
  const storage = fixtureStorage(db);
  await installHistoricalCanonical5(storage);
  await storage.atomicBatch(menuSchemaStatements(storage));
  // Actual Source036 taxonomy shape, solely for menu-reference fixture rows.
  // This is not an implemented taxonomy migration or canonical provider.
  await sql`CREATE TABLE taxonomies (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, label TEXT NOT NULL,
    parent_id TEXT, data TEXT, locale TEXT NOT NULL DEFAULT 'en', translation_group TEXT,
    UNIQUE(name, slug, locale), FOREIGN KEY(parent_id) REFERENCES taxonomies(id) ON DELETE SET NULL
  )`.execute(db);
}
export async function setupTestDatabase(): Promise<KyselyType<Database>> {
  const db = createDatabase({ url: ':memory:' });
  await runMigrations(db);
  return db;
}
export async function teardownTestDatabase(db: KyselyType<Database> | undefined): Promise<void> { if (db) await db.destroy(); }
export interface DialectTestContext { db: KyselyType<Database>; dialect: 'sqlite' }
export function describeEachDialect(name: string, run: (dialect: 'sqlite') => void): void {
  describe(`${name} [native Node SQLite fixture]`, () => run('sqlite'));
}
export async function setupForDialectWithCollections(dialect: 'sqlite'): Promise<DialectTestContext> {
  const db = await setupTestDatabase();
  const { SchemaRegistry } = await import('./schema.ts');
  const registry = new SchemaRegistry(db);
  for (const slug of ['post', 'page']) {
    await registry.createCollection({ slug, label: slug === 'post' ? 'Posts' : 'Pages', labelSingular: slug === 'post' ? 'Post' : 'Page' });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
    await registry.createField(slug, { slug: 'content', label: 'Content', type: 'text' });
  }
  return { db, dialect };
}
export async function teardownForDialect(context: DialectTestContext | undefined): Promise<void> { await teardownTestDatabase(context?.db); }
