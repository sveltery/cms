// Test-only request/database transport. Every result comes from real Native storage.
import { describe } from 'vitest';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeRegistry } from '../../../src/lib/server/database/registry.ts';
import { cmsService } from '../../../src/lib/server/database/service.ts';
import { lifecycleService } from '../../../src/lib/server/database/lifecycle/service.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import type { ServerPrincipal } from '../../../src/lib/server/database/service.ts';

const bindings = new WeakMap<object, CmsDatabase>();
export const principal: ServerPrincipal = { id: 'picker-fixture', permissions: ['schema:read', 'schema:manage', 'content:read', 'content:read_drafts', 'content:create', 'content:publish_any'] };
export type DialectTestContext = { db: CmsDatabase['db']; dialect: 'sqlite' };
export function describeEachDialect(name: string, run: (dialect: 'sqlite') => void) { describe(`${name} (sqlite)`, () => run('sqlite')); }
export async function setupTestDatabase() {
  const database = openSqlite(':memory:'); await migrateCms(database); bindings.set(database.db, database); return database.db;
}
export async function teardownTestDatabase(db: CmsDatabase['db']) { await bindings.get(db)?.close(); }
export async function setupForDialect(_dialect: 'sqlite'): Promise<DialectTestContext> { return { db: await setupTestDatabase(), dialect: 'sqlite' }; }
export async function teardownForDialect(ctx: DialectTestContext) { await teardownTestDatabase(ctx.db); }
export class SchemaRegistry extends NativeRegistry {
  constructor(db: CmsDatabase['db']) { super(bindings.get(db)!); }
  override async updateCollection(slug: string, input: any) {
    const collection = await this.getCollection(slug); if (!collection) throw new Error('Collection not found');
    return super.updateCollection(slug, input, { version: collection.version, updatedAt: collection.updatedAt });
  }
}
export async function handleContentCreate(db: CmsDatabase['db'], collection: string, input: any) {
  try { return { success: true, data: { item: await lifecycleService(bindings.get(db)!, principal, { after: () => {} }).createContent({ type: collection, ...input }) } }; }
  catch (error: any) { return { success: false, error: { code: error.code ?? 'CONTENT_CREATE_ERROR', message: error.message } }; }
}
export async function handleContentList(db: CmsDatabase['db'], collection: string, params: any = {}) {
  const path = '../../../src/lib/server/content-picker/service.ts';
  try {
    const product = await import(/* @vite-ignore */ path);
    return { success: true, data: await product.contentPickerService(bindings.get(db)!, principal).list(collection, params) };
  } catch (error: any) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || /Failed to load url.*content-picker\/service/.test(error.message)) {
      try { return { success: true, data: await cmsService(bindings.get(db)!, principal).listContent({ type: collection, ...params }) }; }
      catch (cause: any) { return { success: false, error: { code: cause.code, message: cause.message } }; }
    }
    return { success: false, error: { code: error.code ?? 'CONTENT_LIST_ERROR', message: error.message } };
  }
}
