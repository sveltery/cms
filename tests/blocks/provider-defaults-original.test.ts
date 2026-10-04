// Supplemental original feature tests. No Source test or auth credit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

async function fixture(runtime: 'node' | 'd1') {
  if (runtime === 'node') {
    const database = openSqlite(':memory:');
    return { database, async dispose() { await database.close(); } };
  }
  const storage = await asyncD1Storage();
  const database = openD1(storage.binding);
  return { database, async dispose() { await database.close(); await storage.runtime.dispose(); } };
}
async function columnDefaults(database: CmsDatabase, table: '_cms_collections' | '_cms_fields') {
  const query = table === '_cms_collections' ? 'PRAGMA table_info("_cms_collections")' : 'PRAGMA table_info("_cms_fields")';
  const rows = (await sql.raw<{name: string; dflt_value: string | null}>(query).execute(database.db)).rows;
  return Object.fromEntries(rows.map(row => [row.name, row.dflt_value]));
}
for (const runtime of ['node', 'd1'] as const) {
  test('ordinary ' + runtime + ' startup installs both block registry tables', async () => {
    const ctx = await fixture(runtime);
    try {
      await migrateCms(ctx.database);
      const rows = (await sql.raw<{name: string}>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('_cms_block_types','_cms_block_type_versions') ORDER BY name").execute(ctx.database.db)).rows;
      assert.deepEqual(rows.map(row => row.name), ['_cms_block_type_versions','_cms_block_types']);
    } finally { await ctx.dispose(); }
  });
  test('ordinary ' + runtime + ' startup provides Source creation defaults and keeps explicit false', async () => {
    const ctx = await fixture(runtime);
    try {
      await migrateCms(ctx.database);
      const collections = await columnDefaults(ctx.database, '_cms_collections');
      const fields = await columnDefaults(ctx.database, '_cms_fields');
      assert.deepEqual({
        collectionCreated: collections.created_at, collectionUpdated: collections.updated_at,
        fieldCreated: fields.created_at, fieldRequired: fields.required,
        fieldUnique: fields.unique, fieldSort: fields.sort_order,
        commentsAutoApprove: collections.comments_auto_approve_users
      }, { collectionCreated: "datetime('now')", collectionUpdated: "datetime('now')",
        fieldCreated: "datetime('now')", fieldRequired: '0', fieldUnique: '0', fieldSort: '0',
        commentsAutoApprove: '1' });
      const registry = new SchemaRegistry(ctx.database);
      const implicit = await registry.createCollection({ slug: 'implicit_default', label: 'Implicit' });
      const explicit = await registry.createCollection({ slug: 'explicit_false', label: 'Explicit', commentsAutoApproveUsers: false });
      assert.equal(implicit.commentsAutoApproveUsers, true);
      assert.equal(explicit.commentsAutoApproveUsers, false);
    } finally { await ctx.dispose(); }
  });
}
