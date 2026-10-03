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
      const versions = (await storage.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row => row.version);
      assert.deepEqual(versions.slice(0,5), [1, 2, 3, 4, 5]);
      assert.deepEqual(versions, [1, 2, 3, 4, 5, 6, 7, 8]);
    } finally { await storage.close(); await worker?.dispose(); }
  });
}

// Literal identity is part of the owned SQL contract; quoted identifier and
// formatting normalization must never rewrite a literal's contents.
const literalCases = [
  { name: 'embedded double quotes', actual: '"en"', expected: 'en' },
  { name: 'repeated literal whitespace', actual: 'en  US', expected: 'en US' },
  { name: 'escaped single quote followed by double quotes', actual: 'en\'"tail"', expected: 'en\'tail' }
];
for (const backend of ['node', 'd1'] as const) {
  for (const [index, literal] of literalCases.entries()) {
    test(`${backend}: menu readiness preserves ${literal.name} in locale defaults`, { timeout: 30_000 }, async () => {
      const worker = backend === 'node' ? undefined : new Miniflare({ modules: true,
        script: 'export default {fetch() {return new Response("fixture")}}',
        compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
        d1Databases: { CMS_DB: `cms-menu-readiness-literal-${index}` }, cf: false });
      const storage = worker ? openD1(await worker.getD1Database('CMS_DB')) : openSqlite(':memory:');
      try {
        await migrateCms(storage);
        await storage.atomicBatch(menuSchemaStatements(storage, literal.actual));
        const before = (await sql`SELECT name, type, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows;
        assert.equal(await menuStorageReady(storage, literal.expected), false);
        assert.equal(await menuStorageReady(storage, literal.actual), true);
        assert.deepEqual((await sql`SELECT name, type, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows, before);
        const versions = (await storage.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row => row.version);
        assert.deepEqual(versions.slice(0,5), [1, 2, 3, 4, 5]);
        assert.deepEqual(versions, [1, 2, 3, 4, 5, 6, 7, 8]);
      } finally { await storage.close(); await worker?.dispose(); }
    });
  }
}

for (const backend of ['node', 'd1'] as const) {
  test(`${backend}: menu readiness distinguishes a quoted timestamp default from the SQL expression`, { timeout: 30_000 }, async () => {
    const worker = backend === 'node' ? undefined : new Miniflare({ modules: true,
      script: 'export default {fetch() {return new Response("fixture")}}',
      compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
      d1Databases: { CMS_DB: 'cms-menu-readiness-timestamp-literal' }, cf: false });
    const storage = worker ? openD1(await worker.getD1Database('CMS_DB')) : openSqlite(':memory:');
    try {
      await migrateCms(storage);
      const wrongDefaults = menuSchemaStatements(storage).map(statement =>
        sql.raw(statement.sql.replaceAll('DEFAULT CURRENT_TIMESTAMP', 'DEFAULT "CURRENT_TIMESTAMP"')).compile(storage.db));
      await storage.atomicBatch(wrongDefaults);
      await sql`INSERT INTO _cms_menus (id, name, label) VALUES ('literal', 'literal', 'Literal')`.execute(storage.db);
      const row = (await sql<{created_at:string}>`SELECT created_at FROM _cms_menus WHERE id = 'literal'`.execute(storage.db)).rows[0];
      assert.equal(row.created_at, 'CURRENT_TIMESTAMP');
      const before = (await sql`SELECT name, type, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows;
      assert.equal(await menuStorageReady(storage), false);
      assert.deepEqual((await sql`SELECT name, type, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows, before);
    } finally { await storage.close(); await worker?.dispose(); }
  });
}
