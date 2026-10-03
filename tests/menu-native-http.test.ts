import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Miniflare } from 'miniflare';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { menuSchemaStatements } from '../src/lib/server/menus/migrations.ts';
import { servicePrincipal } from '../src/lib/server/auth/composition.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
import * as collection from '../src/routes/api/menus/+server.ts';
import * as menu from '../src/routes/api/menus/[name]/+server.ts';
import * as items from '../src/routes/api/menus/[name]/items/+server.ts';
import * as item from '../src/routes/api/menus/[name]/items/[id]/+server.ts';
import * as reorder from '../src/routes/api/menus/[name]/reorder/+server.ts';
import * as translations from '../src/routes/api/menus/[name]/translations/+server.ts';

// Original native request-handler storage contracts, with one already-trusted
// ordinary principal. No session, origin-denial or protected request probes.
for (const backend of ['node', 'd1'] as const) {
  test(`${backend}: native menu routes persist CRUD, hierarchy, locale and error envelopes`, { timeout: 30_000 }, async () => {
    const worker = backend === 'node' ? undefined : new Miniflare({ modules: true,
      script: 'export default {fetch() {return new Response("fixture")}}',
      compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
      d1Databases: { CMS_DB: 'cms-menu-http-fixture' }, cf: false });
    const storage = worker ? openD1(await worker.getD1Database('CMS_DB')) : openSqlite(':memory:');
    await migrateCms(storage);
    const locals = { cms: { database: storage, principal: servicePrincipal({ id: 'fixture-editor', role: Role.EDITOR }), mutationsEnabled: true },
      cmsRuntime: { publicOrigin: 'http://cms.test', basePath: '', rpName: 'Menu fixture' } };
    async function invoke(handler: Function, method: string, path: string, params = {}, body?: unknown) {
      const request = new Request(`http://cms.test${path}`, { method, headers: { origin: 'http://cms.test', 'content-type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return handler({ request, url: new URL(request.url), params, locals });
    }
    async function result(response: Response, status = 200) {
      assert.equal(response.status, status);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      return response.json();
    }
    try {
      const before = (await sql`SELECT name, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows;
      assert.equal((await invoke(collection.GET, 'GET', '/api/menus')).status, 503);
      assert.deepEqual((await sql`SELECT name, sql FROM sqlite_master ORDER BY name`.execute(storage.db)).rows, before);
      await storage.atomicBatch(menuSchemaStatements(storage));
      assert.deepEqual(await result(await invoke(collection.GET, 'GET', '/api/menus')), { success: true, data: [] });
      const created = await result(await invoke(collection.POST, 'POST', '/api/menus', {}, { name: 'primary', label: 'Primary' }), 201);
      assert.equal(created.data.translationGroup, created.data.id);
      const root = await result(await invoke(items.POST, 'POST', '/api/menus/primary/items', { name: 'primary' }, { type: 'custom', label: 'Home', customUrl: '/' }), 201);
      const child = await result(await invoke(items.POST, 'POST', '/api/menus/primary/items', { name: 'primary' }, { type: 'custom', label: 'Child', customUrl: '/child', parentId: root.data.id }), 201);
      await result(await invoke(item.PUT, 'PUT', `/api/menus/primary/items/${child.data.id}`, { name: 'primary', id: child.data.id }, { label: 'Edited' }));
      const ordered = await result(await invoke(reorder.POST, 'POST', '/api/menus/primary/reorder', { name: 'primary' }, { items: [
        { id: root.data.id, parentId: null, sortOrder: 0 }, { id: child.data.id, parentId: root.data.id, sortOrder: 1 }
      ] }));
      assert.deepEqual(ordered.data.map((value: any) => value.label), ['Home', 'Edited']);
      const fr = await result(await invoke(translations.POST, 'POST', '/api/menus/primary/translations?locale=en', { name: 'primary' }, { locale: 'fr', label: 'Principal' }), 201);
      assert.equal(fr.data.translationGroup, created.data.translationGroup);
      const list = await result(await invoke(translations.GET, 'GET', '/api/menus/primary/translations?locale=en', { name: 'primary' }));
      assert.deepEqual(list.data.translations.map((value: any) => value.locale), ['en', 'fr']);
      const ambiguous = await result(await invoke(menu.GET, 'GET', '/api/menus/primary', { name: 'primary' }), 400);
      assert.equal(ambiguous.error.code, 'AMBIGUOUS_LOCALE');
      const conflict = await result(await invoke(collection.POST, 'POST', '/api/menus', {}, { name: 'primary', label: 'Duplicate', locale: 'en' }), 409);
      assert.equal(conflict.error.code, 'CONFLICT');
      await result(await invoke(menu.PUT, 'PUT', '/api/menus/primary?locale=en', { name: 'primary' }, { label: 'Navigation' }));
      const loaded = await result(await invoke(menu.GET, 'GET', '/api/menus/primary?locale=en', { name: 'primary' }));
      assert.equal(loaded.data.label, 'Navigation');
      assert.equal(loaded.data.items[1].parentId, loaded.data.items[0].id);
      const invalid = await result(await invoke(item.PUT, 'PUT', '/api/menus/primary/items/x?locale=en', { name: 'primary', id: 'x' }, { customUrl: 'javascript:alert(1)' }), 400);
      assert.equal(invalid.error.code, 'VALIDATION_ERROR');
      await result(await invoke(item.DELETE, 'DELETE', `/api/menus/primary/items/${child.data.id}?locale=en`, { name: 'primary', id: child.data.id }));
      await result(await invoke(menu.DELETE, 'DELETE', '/api/menus/primary?locale=en', { name: 'primary' }));
      const remaining = await result(await invoke(collection.GET, 'GET', '/api/menus'));
      assert.deepEqual(remaining.data.map((value: any) => value.locale), ['fr']);
      const rows = (await sql<{count: number}>`SELECT COUNT(*) AS count FROM _cms_menu_items WHERE menu_id = ${created.data.id}`.execute(storage.db)).rows;
      assert.equal(rows[0].count, 0);
    } finally { await storage.close(); await worker?.dispose(); }
  });
}
