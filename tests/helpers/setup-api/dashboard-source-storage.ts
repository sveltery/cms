// Original test-only constructor/database transport for the whole pinned dashboard16.
// No app imports this helper; no product result, media schema or provider is synthesized.
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeSchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { dashboardSourceDatabase } from '../../../src/lib/server/setup/dashboard/namespace.ts';

const owned = new WeakMap<object, CmsDatabase>();
function storageFor(db: object): CmsDatabase {
  const storage = owned.get(db);
  if (!storage) throw new Error('Missing actual dashboard Source fixture storage.');
  return storage;
}

export async function setupTestDatabase() {
  const storage = openSqlite(':memory:');
  try {
    await migrateCms(storage);
    // This is the actual product namespace/host seam, not a test-only SQL rewrite.
    const db = dashboardSourceDatabase(storage);
    owned.set(db, storage);
    return db;
  } catch (error) {
    try { await storage.close(); } catch { /* Preserve the primary startup failure. */ }
    throw error;
  }
}
export async function teardownTestDatabase(db: object | undefined) {
  if (!db) return;
  const storage = owned.get(db);
  if (!storage) return;
  owned.delete(db);
  await storage.close();
}

/** Source-shaped arguments delegate to actual Native validation/schema creation. */
export class SchemaRegistry {
  private readonly registry: NativeSchemaRegistry;
  constructor(db: object) { this.registry = new NativeSchemaRegistry(storageFor(db)); }
  createCollection(input: unknown) { return this.registry.createCollection(input); }
  createField(collection: unknown, input: unknown) { return this.registry.createField(collection, input); }
}

export async function setupTestDatabaseWithCollections() {
  const db = await setupTestDatabase();
  try {
    const registry = new SchemaRegistry(db);
    await registry.createCollection({ slug: 'post', label: 'Posts', labelSingular: 'Post' });
    await registry.createField('post', { slug: 'title', label: 'Title', type: 'string' });
    await registry.createField('post', { slug: 'content', label: 'Content', type: 'portableText' });
    await registry.createCollection({ slug: 'page', label: 'Pages', labelSingular: 'Page' });
    await registry.createField('page', { slug: 'title', label: 'Title', type: 'string' });
    await registry.createField('page', { slug: 'content', label: 'Content', type: 'portableText' });
    return db;
  } catch (error) {
    try { await teardownTestDatabase(db); } catch { /* Preserve original schema failure. */ }
    throw error;
  }
}
