// Original native runtime requirements; zero copied Source assertion credit.
// Ordinary persisted single-principal fixtures use the real configured application.
import test from 'node:test';
import { sql } from 'kysely';
import { sectionSchemaStatements, widgetSchemaStatements } from '../../src/lib/server/sections-widgets/schema.ts';
import assert from 'node:assert/strict';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { withActualSectionWidgetClient } from '../helpers/sections-widgets/runtime-client.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: real section API reports absent storage and preserves reusable content CRUD`, async t => {
    const runtime = await passkeyRuntime(target);
    t.after(() => runtime.close());
    await runtime.request('/');
    const database = await runtime.database();
    const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    await database.db.insertInto('_cms_auth_users').values({ id: 'section-editor', role: Role.EDITOR, disabled: 0 }).execute();
    await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'section-editor', expires_at: Date.now() + 60_000 }).execute();
    async function request(path: string, method = 'GET', body?: unknown) {
      return runtime.request(path, { method, headers: { cookie: `cms-session=${token}`, origin: runtime.origin,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    // An actual bounded partial installation preserves truthful storage denial.
    // Markers/identities/source bodies are unchanged; requests perform no DDL.
    await sql`DROP TABLE _cms_sections`.execute(database.db);
    const absent = await request('/api/sections');
    assert.equal(absent.status, 503);
    // Explicit restore of the exact actual canonical12 schema; setup only.
    await database.atomicBatch(sectionSchemaStatements(database.db));
    const content = [{ _type: 'block', _key: 'b1', style: 'h2', children: [{ _type: 'span', _key: 's1', text: 'Reusable hero', marks: [] }], markDefs: [] }];
    const create = await request('/api/sections', 'POST', { slug: 'hero', title: 'Hero Section', content, keywords: ['welcome'] });
    assert.equal(create.status, 201);
    const created = (await create.json()).data;
    assert.equal(created.slug, 'hero'); assert.deepEqual(created.content, content);
    const listed = await request('/api/sections?search=welcome'); assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json()).data.items.map((s: { slug: string }) => s.slug), ['hero']);
    const update = await request('/api/sections/hero', 'PUT', { title: 'Updated Hero', keywords: ['landing'] });
    assert.equal(update.status, 200); assert.equal((await update.json()).data.title, 'Updated Hero');
    const duplicate = await request('/api/sections', 'POST', { slug: 'hero', title: 'Duplicate', content: [] });
    assert.equal(duplicate.status, 409);
    const read = await request('/api/sections/hero'); assert.equal(read.status, 200); assert.deepEqual((await read.json()).data.content, content);
    const removed = await request('/api/sections/hero', 'DELETE'); assert.equal(removed.status, 200);
    assert.equal((await request('/api/sections/hero')).status, 404);
  });
  test(`${target}: real widget API preserves area contents, changes, ordering and cascade deletion`, async t => {
    const runtime = await passkeyRuntime(target);
    t.after(() => runtime.close());
    await runtime.request('/');
    const database = await runtime.database();
    const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    await database.db.insertInto('_cms_auth_users').values({ id: 'widget-editor', role: Role.EDITOR, disabled: 0 }).execute();
    await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'widget-editor', expires_at: Date.now() + 60_000 }).execute();
    async function request(path: string, method = 'GET', body?: unknown) {
      return runtime.request(path, { method, headers: { cookie: `cms-session=${token}`, origin: runtime.origin,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    await sql`DROP TABLE _cms_widgets`.execute(database.db);
    await sql`DROP TABLE _cms_widget_areas`.execute(database.db);
    assert.equal((await request('/api/widget-areas')).status, 503);
    await database.atomicBatch(widgetSchemaStatements(database.db));
    const area = await request('/api/widget-areas', 'POST', { name: 'sidebar', label: 'Sidebar', description: 'Main sidebar' });
    assert.equal(area.status, 201);
    const first = await request('/api/widget-areas/sidebar/widgets', 'POST', { type: 'content', title: 'Welcome', content: [] });
    assert.equal(first.status, 201); const one = (await first.json()).data;
    const second = await request('/api/widget-areas/sidebar/widgets', 'POST', { type: 'component', componentId: 'core:search', componentProps: { placeholder: 'Find' } });
    assert.equal(second.status, 201); const two = (await second.json()).data;
    const reordered = await request('/api/widget-areas/sidebar/reorder', 'POST', { widgetIds: [two.id, one.id] });
    assert.equal(reordered.status, 200);
    const current = await request('/api/widget-areas/sidebar'); assert.equal(current.status, 200);
    assert.deepEqual((await current.json()).data.widgets.map((w: { id: string }) => w.id), [two.id, one.id]);
    const update = await request(`/api/widget-areas/sidebar/widgets/${one.id}`, 'PUT', { title: 'Updated', content: [{ _type: 'block', children: [] }] });
    assert.equal(update.status, 200); assert.equal((await update.json()).data.title, 'Updated');
    const components = await request('/api/widget-components'); assert.equal(components.status, 200);
    assert.ok((await components.json()).data.items.some((c: { id: string }) => c.id === 'core:search'));
    // Ordinary canonical11 already provides menu storage.
    // Reuse this callback's sole persisted Editor, with no new identity/auth probe.
    const menu = await request('/api/menus', 'POST', { name: 'widget-navigation', label: 'Widget navigation' });
    assert.equal(menu.status, 201);
    const menuList = await request('/api/menus');
    assert.equal(menuList.status, 200);
    const realMenus = (await menuList.json()).data;
    assert.deepEqual(realMenus.map((item: { name: string }) => item.name), ['widget-navigation']);
    await withActualSectionWidgetClient(runtime.origin, `cms-session=${token}`, async api => {
      assert.deepEqual(await api.fetchMenus(), realMenus);
    });
    assert.equal((await request('/api/widget-areas/sidebar', 'DELETE')).status, 200);
    assert.equal((await request('/api/widget-areas/sidebar')).status, 404);
    const remaining = await database.db.withTables<{ _cms_widgets: { id: string } }>().selectFrom('_cms_widgets').selectAll().execute();
    assert.deepEqual(remaining, []);
  });
}
