// Existing actual canonical installation/registry fixture transport, shared by
// whole pinned query families. No rows, SQL, expectations or principals are faked.
import { describe } from 'vitest';
import { OperationNodeTransformer, type KyselyPlugin, type TableNode } from 'kysely';
import { setupTestDatabase as setupExistingDatabase } from '../full-search/source-host.ts';
import { lifecycleDatabase, registerLifecycleDatabase } from '../../../src/lib/server/database/lifecycle/upstream/host.ts';
import { lifecycleService } from '../../../src/lib/server/database/lifecycle/service.ts';
import { principal } from '../content-picker/source-host.ts';
import { SchemaRegistry as NativeRegistry } from '../../../src/lib/server/database/registry.ts';
import { queryDatabaseOwner, queryReadDatabase } from '../../../src/lib/server/query-sdk/bindings.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { registerBylineDatabase } from '../../../src/lib/server/bylines/storage.ts';

// The Native dialect host has no PostgreSQL pool. Its whole-family cleanup
// closes any actual fixture adapters still open after a failed setup/teardown.
const activeDatabases = new Map<CmsDatabase['db'], CmsDatabase>();

// The original byline-filter fixtures insert through ordinary Kysely builders.
// Map only their TableNode to the real already-installed Native pivot. Raw SQL,
// literals, supplied rows and whole Source assertion bodies remain untouched.
class BylineFixtureTable extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const value = super.transformTable(node);
    if (value.table.schema || value.table.identifier.name !== '_emdash_content_bylines') return value;
    return {...value, table: {...value.table, identifier: {...value.table.identifier, name: '_cms_content_bylines'}}};
  }
}
const bylineFixtureTable = new BylineFixtureTable();
const bylineFixturePlugin: KyselyPlugin = {
  transformQuery({node}) {return bylineFixtureTable.transformNode(node);},
  async transformResult({result}) {return result;}
};

export async function setupTestDatabase() {
  const original = await setupExistingDatabase();
  const database = queryDatabaseOwner(original);
  const sourceFixtureDb = original.withPlugin(bylineFixturePlugin);
  registerLifecycleDatabase({...database, db: sourceFixtureDb}, {after: task => {void task();}});
  const db = queryReadDatabase(sourceFixtureDb as unknown as import('kysely').Kysely<unknown>) as unknown as CmsDatabase['db'];
  registerLifecycleDatabase({...database, db}, {after: task => {void task();}});
  registerBylineDatabase({...database, db});
  activeDatabases.set(db, database);
  return db;
}

export async function teardownTestDatabase(db: CmsDatabase['db']) {
  const database = activeDatabases.get(db) ?? queryDatabaseOwner(db);
  try { await database.close(); }
  finally { activeDatabases.delete(db); }
}

export async function destroySharedPool(): Promise<void> {
  const databases = [...activeDatabases.values()];
  activeDatabases.clear();
  await Promise.all(databases.map(database => database.close()));
}

export class SchemaRegistry extends NativeRegistry {
  constructor(db: CmsDatabase['db']) {super(queryDatabaseOwner(db));}
  override async updateCollection(slug: string, input: unknown) {
    const collection = await this.getCollection(slug);
    if (!collection) throw new Error('Collection not found');
    return super.updateCollection(slug, input, {version: collection.version, updatedAt: collection.updatedAt});
  }
}

export async function setupTestDatabaseWithCollections() {
  const db = await setupTestDatabase();
  const registry = new SchemaRegistry(db);
  for (const [slug, label, labelSingular] of [['post', 'Posts', 'Post'], ['page', 'Pages', 'Page']]) {
    await registry.createCollection({slug, label, labelSingular});
    await registry.createField(slug, {slug: 'title', label: 'Title', type: 'string'});
    await registry.createField(slug, {slug: 'content', label: 'Content', type: 'portableText'});
  }
  return db;
}

export type DialectTestContext = {
  db: Awaited<ReturnType<typeof setupTestDatabase>>;
  dialect: 'sqlite';
};

export function describeEachDialect(name: string, run: (dialect: 'sqlite') => void) {
  describe(`${name} [sqlite]`, () => run('sqlite'));
}

export async function setupForDialect(_dialect: 'sqlite'): Promise<DialectTestContext> {
  return {db: await setupTestDatabase(), dialect: 'sqlite'};
}

export async function setupForDialectWithCollections(_dialect: 'sqlite'): Promise<DialectTestContext> {
  return {db: await setupTestDatabaseWithCollections(), dialect: 'sqlite'};
}

export async function teardownForDialect(context: DialectTestContext): Promise<void> {
  await teardownTestDatabase(context.db);
}

// The original supplied controlled service-principal fixture is reused from the
// already-published content-picker test host. This adds no credential/session,
// HTTP or principal producer. Every returned item comes from real storage.
export async function handleContentCreate(
  db: DialectTestContext['db'],
  collection: string,
  input: Record<string, unknown>
) {
  try {
    const database = lifecycleDatabase(db);
    if (!database) throw new Error('No Native lifecycle database fixture binding');
    const service = lifecycleService(database, principal, {after: () => {}});
    if (input.status !== undefined && input.status !== 'draft' && input.status !== 'published') {
      throw new Error('This Native fixture has no published scheduler/status producer');
    }
    // The Native public service creates a draft and publishes through its real
    // persisted CAS contract. The old Source fixture accepts published create;
    // this real two-operation transport earns no single-write API parity credit.
    let item = await service.createContent({...input, status: undefined, type: collection});
    if (input.status === 'published') {
      item = await service.publish({type: collection, id: item.id, locale: item.locale, publishedAt: input.publishedAt,
        expected: {version: item.version, updatedAt: item.updatedAt}});
    }
    return {success: true as const, data: {item}};
  } catch (error) {
    return {success: false as const, error: error instanceof Error ? error : new Error(String(error))};
  }
}
