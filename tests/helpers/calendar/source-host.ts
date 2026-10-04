import { describe } from 'vitest';
import { OperationNodeTransformer, type KyselyPlugin, type TableNode } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeRegistry } from '../../../src/lib/server/database/registry.ts';
import { registerLifecycleDatabase } from '../../../src/lib/server/database/lifecycle/upstream/host.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

// Constructor/fixture transport only: every result is actual public Native
// storage. Only metadata TableNode identifiers are mapped; no result, SQL
// literal, data, assertion or sqlite_master response is replaced.
const names: Readonly<Record<string, string>> = { _emdash_collections: '_cms_collections', _emdash_fields: '_cms_fields' };
class MetadataNamespace extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const result = super.transformTable(node);
    const name = names[result.table.identifier.name];
    return name ? { ...result, table: { ...result.table, identifier: { ...result.table.identifier, name } } } : result;
  }
}
const transformer = new MetadataNamespace();
const namespace: KyselyPlugin = {
  transformQuery: ({ node }) => transformer.transformNode(node),
  transformResult: async ({ result }) => result
};
const bindings = new WeakMap<object, CmsDatabase>();
export function fixtureStorage(db: CmsDatabase['db']): CmsDatabase {
  const database = bindings.get(db);
  if (!database) throw new Error('Calendar Source fixture storage not registered');
  return database;
}
export async function setupTestDatabase() {
  const base = openSqlite(':memory:');
  try {
    await migrateCms(base);
    const database = { ...base, db: base.db.withPlugin(namespace) };
    bindings.set(database.db, database);
    registerLifecycleDatabase(database);
    return database.db;
  } catch (error) { await base.close(); throw error; }
}
export async function teardownTestDatabase(db: CmsDatabase['db'] | undefined) {
  if (db) await fixtureStorage(db).close();
}
export class SchemaRegistry extends NativeRegistry {
  constructor(db: CmsDatabase['db']) { super(fixtureStorage(db)); }
}
export async function setupTestDatabaseWithCollections() {
  const db = await setupTestDatabase();
  const registry = new SchemaRegistry(db);
  for (const slug of ['post', 'page']) {
    await registry.createCollection({ slug, label: slug === 'post' ? 'Posts' : 'Pages', labelSingular: slug === 'post' ? 'Post' : 'Page' });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
    await registry.createField(slug, { slug: 'content', label: 'Content', type: 'portableText' });
  }
  return db;
}
export type DialectTestContext = { db: CmsDatabase['db']; dialect: 'sqlite' };
export function describeEachDialect(name: string, run: (dialect: 'sqlite') => void) {
  describe(`${name} (Native Node SQLite)`, () => run('sqlite'));
}
export async function setupForDialectWithCollections(dialect: 'sqlite'): Promise<DialectTestContext> {
  return { db: await setupTestDatabaseWithCollections(), dialect };
}
export async function teardownForDialect(context: DialectTestContext | undefined) {
  await teardownTestDatabase(context?.db);
}
