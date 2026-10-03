import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { Miniflare } from 'miniflare';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { menuSchemaStatements } from '../src/lib/server/menus/migrations.ts';
import { menuStorageReady } from '../src/lib/server/menus/readiness.ts';

// Original native readonly readiness evidence; descriptors are explicitly
// applied by this named fixture only, never by a product request.
for (const backend of ['node', 'd1'] as const) {
  test(`${backend}: menu readiness accepts only the complete owned schema and never installs it`, { timeout: 30_000 }, async () => {
    const worker = backend === 'node' ? undefined : new Miniflare({ modules: true,
      script: 'export default {fetch() {return new Response("fixture")}}',
      compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
      d1Databases: { CMS_DB: 'cms-menu-readiness-fixture' }, cf: false });
    const storage = worker ? openD1(await worker.getD1Database('CMS_DB')) : openSqlite(':memory:');
    try {
      await migrateCms(storage);
      const before = (await sql`SELECT name, type, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows;
      assert.equal(await menuStorageReady(storage), false);
      assert.deepEqual((await sql`SELECT name, type, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows, before);
      const descriptor = menuSchemaStatements(storage);
      await storage.atomicBatch(descriptor.slice(0, 2));
      assert.equal(await menuStorageReady(storage), false);
      await storage.atomicBatch(descriptor.slice(2));
      assert.equal(await menuStorageReady(storage), true);
      await sql`CREATE INDEX unexpected_menu_index ON _cms_menus(label)`.execute(storage.db);
      assert.equal(await menuStorageReady(storage), false);
      await sql`DROP INDEX unexpected_menu_index`.execute(storage.db);
      assert.equal(await menuStorageReady(storage), true);
      await sql`DROP INDEX idx_menu_items_parent`.execute(storage.db);
      await sql`CREATE INDEX idx_menu_items_parent ON _cms_menu_items(label)`.execute(storage.db);
      assert.equal(await menuStorageReady(storage), false);
      assert.equal((await storage.db.selectFrom('_cms_migrations').select('version').executeTakeFirst())?.version, 5);
    } finally { await storage.close(); await worker?.dispose(); }
  });
}
