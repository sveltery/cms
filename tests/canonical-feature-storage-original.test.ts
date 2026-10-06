// Original canonical installation requirements. Zero copied Source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { createRequestScopedDb } from '../src/lib/server/runtime/cloudflare-d1.ts';

type Runtime = 'Node' | 'raw D1' | 'scoped D1';
async function storage(runtime: Runtime) {
  if (runtime === 'Node') {
    const database = openSqlite(':memory:');
    return { database, close: () => database.close() };
  }
  const worker = new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("ordinary storage fixture"); } }',
    compatibilityDate: '2026-05-07', d1Databases: { CMS_DB: 'canonical-feature-storage' },
    host: '127.0.0.1', port: 0, cf: false });
  try {
    const binding = await worker.getD1Database('CMS_DB');
    const raw = openD1(binding);
    const scope = runtime === 'scoped D1' ? createRequestScopedDb({
      config: { binding: 'CMS_DB', session: 'auto', coalesce: true },
      binding: binding as unknown as D1Database, isAuthenticated: false, isWrite: true,
      cookies: { get() { return undefined; }, set() {} },
      url: new URL('https://ordinary-storage.invalid/')
    }) : null;
    if (runtime === 'scoped D1') assert.ok(scope);
    return { database: scope?.database ?? raw, async close() {
      try { if (scope) await scope.database.close(); await raw.close(); }
      finally { await worker.dispose(); }
    } };
  } catch (error) { await worker.dispose(); throw error; }
}

const featureTables = {
  'media and byline prerequisites': ['_cms_media', '_cms_media_folders', '_cms_bylines',
    '_cms_content_bylines', '_cms_byline_fields', '_cms_byline_field_values', '_cms_byline_field_group_values'],
  'directed content links': ['_cms_relations', '_cms_content_references'],
  menus: ['_cms_menus', '_cms_menu_items'],
  'sections and site widgets': ['_cms_sections', '_cms_widget_areas', '_cms_widgets'],
  'comments and moderation': ['_cms_comments', '_cms_comment_reactions', '_cms_comment_options', '_cms_comment_rate_limits'],
  redirects: ['_cms_redirects', '_cms_redirect_write_lock', '_cms_redirect_state',
    '_cms_redirect_artifacts', '_cms_redirect_generation_artifacts', '_cms_404_log']
} as const;

for (const runtime of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${runtime}: ordinary canonical startup installs actual contiguous providers through 19`, { timeout: 90_000 }, async () => {
    const fixture = await storage(runtime);
    try {
      await migrateCms(fixture.database);
      const markers = (await sql<{ version: number }>`SELECT version FROM _cms_migrations ORDER BY version`
        .execute(fixture.database.db)).rows.map(row => row.version);
      assert.deepEqual(markers, Array.from({ length: 19 }, (_, index) => index + 1));
      assert.equal((await fixture.database.db.selectFrom('_cms_auth_users').selectAll().execute()).length, 0);
      assert.equal((await fixture.database.db.selectFrom('_cms_auth_sessions').selectAll().execute()).length, 0);
    } finally { await fixture.close(); }
  });

  for (const [feature, wanted] of Object.entries(featureTables)) {
    test(`${runtime}: fresh ordinary startup makes ${feature} storage available`, { timeout: 90_000 }, async () => {
      const fixture = await storage(runtime);
      try {
        await migrateCms(fixture.database);
        const objects = (await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type = 'table'`
          .execute(fixture.database.db)).rows.map(row => row.name);
        assert.deepEqual(wanted.filter(name => objects.includes(name)), [...wanted]);
        await migrateCms(fixture.database);
        const reopenedObjects = (await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type = 'table'`
          .execute(fixture.database.db)).rows.map(row => row.name);
        assert.deepEqual(reopenedObjects, objects);
      } finally { await fixture.close(); }
    });
  }
}
