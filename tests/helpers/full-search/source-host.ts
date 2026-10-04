// Test-only import/database transport for unchanged whole EmDash search families.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc.
// MIT; notices/emdash-MIT.txt. No raw SQL, literals, rows or assertions are rewritten.
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeRegistry } from '../../../src/lib/server/database/registry.ts';
import { registerLifecycleDatabase } from '../../../src/lib/server/database/lifecycle/upstream/host.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

const bindings = new WeakMap<object, CmsDatabase>();
export async function setupTestDatabase() {
  const database = openSqlite(':memory:');
  await migrateCms(database);
  registerLifecycleDatabase(database, { after: task => { void task(); } });
  bindings.set(database.db, database);
  return database.db;
}
export async function teardownTestDatabase(db: CmsDatabase['db']) {
  await bindings.get(db)?.close();
}
export class SchemaRegistry extends NativeRegistry {
  constructor(db: CmsDatabase['db']) { super(bindings.get(db)!); }
  override async updateCollection(slug: string, input: unknown) {
    const collection = await this.getCollection(slug);
    if (!collection) throw new Error('Collection not found');
    return super.updateCollection(slug, input, { version: collection.version, updatedAt: collection.updatedAt });
  }
}
// The original standard-collection fixture retains its collection/field inputs.
export async function setupTestDatabaseWithCollections() {
  const db = await setupTestDatabase();
  const registry = new SchemaRegistry(db);
  await registry.createCollection({ slug: 'post', label: 'Posts', labelSingular: 'Post' });
  await registry.createField('post', { slug: 'title', label: 'Title', type: 'string' });
  await registry.createField('post', { slug: 'content', label: 'Content', type: 'portableText' });
  await registry.createCollection({ slug: 'page', label: 'Pages', labelSingular: 'Page' });
  await registry.createField('page', { slug: 'title', label: 'Title', type: 'string' });
  await registry.createField('page', { slug: 'content', label: 'Content', type: 'portableText' });
  return db;
}
