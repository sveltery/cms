import test from 'node:test';
import assert from 'node:assert/strict';
import type { RequestEvent } from '@sveltejs/kit';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { workspaceNavigation } from '../src/lib/server/ui/navigation.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

// Original native storage/display integration, with no authentication ceremony.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: navigation reads actual persisted descriptors and refreshed metadata`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const registry = new SchemaRegistry(storage.database);
      await registry.createCollection({ slug: 'events', label: 'Events', group: 'Calendar', icon: 'calendar' });
      await registry.createCollection({ slug: 'private_notes', label: 'Private notes', hidden: true });
      const event = { locals: { cms: { database: storage.database, principal: { id: 'native-display',
        permissions: ['content:read', 'content:read_drafts', 'schema:manage'] } } } } as Pick<RequestEvent, 'locals'>;
      const before = await workspaceNavigation(event);
      assert.equal(before.authenticated, true);
      assert.deepEqual(before.collections.events, { label: 'Events', hidden: undefined, group: 'Calendar', icon: 'calendar' });
      assert.equal(before.collections.private_notes.hidden, true);
      assert.doesNotMatch(JSON.stringify(before), /native-display|fields|defaultValue|session/);
      const collection = await registry.getCollection('events');
      await registry.updateCollection('events', { label: 'Meetings' }, { version: collection!.version, updatedAt: collection!.updatedAt });
      assert.equal((await workspaceNavigation(event)).collections.events.label, 'Meetings');
    } finally { await storage.close(); }
  });
}
test('anonymous and denied navigation avoids all storage inspection', async () => {
  const database = new Proxy({}, { get() { throw new Error('storage must not be inspected'); } });
  const anonymous = { locals: { cms: { database, principal: null } } } as unknown as Pick<RequestEvent, 'locals'>;
  assert.deepEqual(await workspaceNavigation(anonymous), { authenticated: false, permissions: [], collections: {} });
  const denied = { locals: { cms: { database, principal: { id: 'native-denied', permissions: ['content:read'] } } } } as unknown as Pick<RequestEvent, 'locals'>;
  assert.deepEqual(await workspaceNavigation(denied), { authenticated: true, permissions: ['content:read'], collections: {} });
});
test('authenticated unconfigured navigation preserves the principal and explicit storage availability', async () => {
  const event = { locals: { cms: { principal: { id: 'native-unconfigured', permissions: ['content:read', 'content:read_drafts'] } } } } as unknown as Pick<RequestEvent, 'locals'>;
  assert.deepEqual(await workspaceNavigation(event), { authenticated: true, permissions: ['content:read', 'content:read_drafts'], collections: {}, unavailable: true });
});
