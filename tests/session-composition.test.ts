import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { servicePrincipal, createCmsHandle } from '../src/lib/server/auth/composition.ts';
import { hashSessionToken, revokeSession } from '../src/lib/server/auth/session.ts';
import { createKyselySessionStore } from '../src/lib/server/auth/store.ts';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
import { Permissions } from '../src/lib/server/auth/permissions.ts';
import type { Handle } from '@sveltejs/kit';

test('server bridge derives the supported content and publication permissions from a current role', () => {
  assert.equal(servicePrincipal(null), null);
  const author = servicePrincipal({ id: 'author', role: Role.AUTHOR });
  assert.deepEqual(author, { id: 'author', permissions: ['content:read', 'content:read_drafts', 'content:create', 'content:edit_own', 'content:delete_own', 'content:publish_own', 'taxonomies:read', 'menus:read', 'sections:read', 'widgets:read', 'comments:read', 'bylines:read'] });
  assert.ok(Object.isFrozen(author)); assert.ok(Object.isFrozen(author!.permissions));
  assert.deepEqual(servicePrincipal({ id: 'contributor', role: Role.CONTRIBUTOR })!.permissions, ['content:read', 'content:read_drafts', 'content:create', 'taxonomies:read', 'menus:read', 'sections:read', 'widgets:read', 'comments:read', 'bylines:read']);
  assert.equal(servicePrincipal({ id: 'bad', role: 999 as any }), null);
  assert.equal(servicePrincipal({ id: '', role: Role.ADMIN }), null);
  assert.equal(servicePrincipal({ id: 'x'.repeat(129), role: Role.ADMIN }), null);
  assert.equal(servicePrincipal({ id: 'admin', role: Role.ADMIN })!.permissions.length, 27);
  // Supplemental bridge assertions, grounded in pinned RBAC thresholds.
  // EmDash913cb1 packages/auth/src/rbac.ts:42 taxonomies:read SUBSCRIBER.
  assert.equal(Permissions['taxonomies:read'], Role.SUBSCRIBER);
  assert.ok(servicePrincipal({id:'subscriber',role:Role.SUBSCRIBER})!.permissions.includes('taxonomies:read'));
  assert.ok(!author!.permissions.includes('taxonomies:manage'));
  assert.ok(servicePrincipal({id:'editor',role:Role.EDITOR})!.permissions.includes('taxonomies:manage'));
  assert.ok(servicePrincipal({id:'editor',role:Role.EDITOR})!.permissions.includes('content:publish_own'));
  assert.ok(servicePrincipal({id:'editor',role:Role.EDITOR})!.permissions.includes('content:publish_any'));
  assert.ok(!author!.permissions.includes('content:publish_any'));
});

test('request-scoped cookie resolution observes role changes, revocation and expiry, with writes disabled by default', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const db = database.db;
    const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    const hash = (await hashSessionToken(token))!;
    await db.insertInto('_cms_auth_users').values({ id: 'author', role: Role.AUTHOR, disabled: 0 }).execute();
    await db.insertInto('_cms_auth_sessions').values({ hash, user_id: 'author', expires_at: Date.now() + 60_000 }).execute();
    const handle = createCmsHandle(() => ({ database }));
    async function run(cookie?: string) {
      const event = { cookies: { get: (name: string) => { assert.equal(name, 'cms-session'); return cookie; } }, locals: {}, platform: undefined } as any;
      await handle({ event, resolve: async () => new Response() } as Parameters<Handle>[0]);
      return event.locals.cms;
    }
    const first = await run(token);
    assert.equal(first.principal.id, 'author'); assert.equal(first.mutationsEnabled, false);
    await db.updateTable('_cms_auth_users').set({ role: Role.SUBSCRIBER }).execute();
    assert.deepEqual((await run(token)).principal.permissions, ['content:read', 'taxonomies:read', 'menus:read', 'sections:read', 'widgets:read', 'comments:read', 'bylines:read']);
    assert.ok(first.principal.permissions.includes('content:create'));
    await db.updateTable('_cms_auth_users').set({ disabled: 1 }).execute();
    assert.equal((await run(token)).principal, null);
    await db.updateTable('_cms_auth_users').set({ disabled: 0 }).execute();
    await db.updateTable('_cms_auth_sessions').set({ expires_at: Date.now() - 1 }).execute();
    assert.equal((await run(token)).principal, null);
    await db.updateTable('_cms_auth_sessions').set({ expires_at: Date.now() + 60_000 }).execute();
    await revokeSession(token, createKyselySessionStore(db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()));
    assert.equal((await run(token)).principal, null);
    assert.equal((await run()).principal, null);
    assert.equal((await run('admin')).principal, null);
  } finally { await database.close(); }
});

test('unconfigured handle clears stale locals and does not open or migrate storage', async () => {
  const event = { locals: { cms: { principal: { id: 'admin', permissions: ['schema:manage'] } } } } as any;
  const handle = createCmsHandle(() => undefined);
  await handle({ event, resolve: async () => new Response() } as any);
  assert.equal(event.locals.cms, undefined);
});
