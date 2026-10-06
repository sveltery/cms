// Original normal-installation requirements. Zero copied Source assertion credit.
// Source chronology/provenance: docs/canonical-installation-source.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql, Kysely, type CompiledQuery, type QueryResult } from 'kysely';
import { Miniflare } from 'miniflare';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { CoalescingD1Dialect } from '../src/lib/server/database/coalescing-d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import type { CmsDatabase, CmsTables } from '../src/lib/server/database/contract.ts';

type Target = 'Node SQLite' | 'raw D1' | 'scoped D1';
async function storage(target: Target) {
  if (target === 'Node SQLite') {
    const database = openSqlite(':memory:');
    return { database, close: () => database.close() };
  }
  const worker = new Miniflare({ modules: true,
    script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { DB: 'cms-canonical-installation' }, cf: false });
  const binding = await worker.getD1Database('DB');
  let database: CmsDatabase;
  if (target === 'raw D1') database = openD1(binding);
  else {
    // The actual production coalescing dialect and atomic adapter, on real D1.
    // No principal, cookie, session challenge or authentication probe is created.
    const dialect = new CoalescingD1Dialect({ database: binding });
    const adapter = dialect.createAdapter();
    const db = new Kysely<CmsTables>({ dialect });
    database = { db,
      atomicBatch(statements: readonly CompiledQuery[]): Promise<readonly QueryResult<unknown>[]> {
        return db.connection().execute(() => adapter.executeAtomicBatch(statements));
      },
      close: () => db.destroy() };
  }
  return { database, async close() {
    try { await database.close(); } finally { await worker.dispose(); }
  } };
}

const targets: Target[] = ['Node SQLite', 'raw D1', 'scoped D1'];
for (const target of targets) {
  test(`${target}: normal installer applies real contiguous providers through eight`, { timeout: 30_000 }, async () => {
    const h = await storage(target);
    try {
      await migrateCms(h.database);
      const versions = await h.database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute();
      assert.deepEqual(versions.slice(0,8).map(row => row.version), [1, 2, 3, 4, 5, 6, 7, 8]);
      assert.deepEqual(versions.map(row => row.version), [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]);
      await migrateCms(h.database);
      assert.deepEqual(await h.database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute(), versions);
    } finally { await h.close(); }
  });

  test(`${target}: normal installation enables actual settings and taxonomy storage`, { timeout: 30_000 }, async () => {
    const h = await storage(target);
    try {
      await migrateCms(h.database);
      const names = (await sql<{name: string}>`SELECT name FROM sqlite_master WHERE type = 'table'`.execute(h.database.db)).rows.map(row => row.name);
      const required = ['_cms_options', '_cms_plugin_storage', '_cms_plugin_state', '_cms_plugin_indexes',
        '_cms_taxonomies', '_cms_content_taxonomies', '_cms_taxonomy_defs', '_cms_taxonomy_def_groups'];
      assert.deepEqual(required.filter(name => names.includes(name)), required);
    } finally { await h.close(); }
  });

  test(`${target}: normal metadata upgrade enables the Source collection field cascade`, { timeout: 30_000 }, async () => {
    const h = await storage(target);
    try {
      await migrateCms(h.database);
      const foreignKeys = (await sql<{table: string; from: string; on_delete: string}>`PRAGMA foreign_key_list(_cms_fields)`.execute(h.database.db)).rows;
      const collection = foreignKeys.find(row => row.table === '_cms_collections' && row.from === 'collection_id');
      assert.equal(collection?.on_delete, 'CASCADE');
      const columns = (await sql<{name: string; dflt_value: string | null}>`PRAGMA table_info(_cms_collections)`.execute(h.database.db)).rows;
      assert.equal(columns.find(column => column.name === 'search_config')?.dflt_value, null);
    } finally { await h.close(); }
  });
}
