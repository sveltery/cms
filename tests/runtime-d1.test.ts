// Supplemental request composition over real local workerd/D1 storage.
// This does not establish an adapter-cloudflare application build or deployed runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import type { RequestEvent } from '@sveltejs/kit';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { createEnvironmentCmsRuntime } from '../src/lib/server/runtime/environment.ts';
import { hashSessionToken } from '../src/lib/server/auth/session.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';

test('trusted D1 platform configuration migrates local storage, resolves fresh roles and forwards request waitUntil', { timeout: 30_000 }, async () => {
  const worker = new Miniflare({ modules: true, script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, d1Databases: { CMS_DB: 'cms-runtime-d1' }, cf: false });
  const binding = await worker.getD1Database('CMS_DB');
  let runtime = createEnvironmentCmsRuntime(() => ({}), '/cms');
  const lifetimeTasks: Promise<void>[] = [];
  const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
  const event = (authenticated = false) => ({
    locals: {}, cookies: { get: () => authenticated ? token : undefined },
    platform: { env: { CMS_DB: binding, CMS_PUBLIC_ORIGIN: 'https://cms.example' },
      context: { waitUntil(task: Promise<void>) { lifetimeTasks.push(task); } } }
  }) as unknown as RequestEvent;
  async function visit(authenticated = false) {
    const request = event(authenticated);
    await runtime.handle({ event: request, resolve: async () => new Response('ok') });
    return request.locals;
  }
  try {
    const anonymous = await visit();
    assert.equal(anonymous.cms!.principal, null);
    assert.equal(anonymous.cms!.mutationsEnabled, true);
    assert.deepEqual(anonymous.cmsRuntime, { publicOrigin: 'https://cms.example', basePath: '/cms', rpName: 'Sveltery CMS' });
    const database = anonymous.cms!.database;
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'notes', label: 'Notes' });
    await registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
    const entry = await new DraftRepository(database).create({ type: 'notes', data: { title: 'D1 persistent draft' } }, 'owner');
    await database.db.insertInto('_cms_auth_users').values({ id: 'owner', role: Role.AUTHOR, disabled: 0 }).execute();
    await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'owner', expires_at: Date.now() + 60_000 }).execute();
    const authenticated = await visit(true);
    assert.equal(authenticated.cms!.principal!.id, 'owner');
    assert.ok(authenticated.cms!.principal!.permissions.includes('content:edit_own'));
    assert.equal(lifetimeTasks.length, 1);
    await Promise.all(lifetimeTasks);
    await runtime.close();
    runtime = createEnvironmentCmsRuntime(() => ({}), '/cms');
    const reopened = await visit(true);
    assert.equal((await new DraftRepository(reopened.cms!.database).findById('notes', entry.id))!.data.title, 'D1 persistent draft');
    await reopened.cms!.database.db.updateTable('_cms_auth_users').set({ role: Role.SUBSCRIBER }).where('id', '=', 'owner').execute();
    const demoted = await visit(true);
    assert.deepEqual(demoted.cms!.principal!.permissions, ['content:read', 'menus:read', 'comments:read']);
  } finally { await runtime.close(); await worker.dispose(); }
});
