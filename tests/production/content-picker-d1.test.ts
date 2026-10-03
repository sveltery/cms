import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { contentPickerService } from '../../src/lib/server/content-picker/service.ts';

// Ordinary storage behavior on a real raw workerd/D1 binding. Fixed trusted
// principal only: no auth, session, concurrent request, or Origin probes.
test('raw D1 picker retains full locale variants, cursor pages and literal search across reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-picker-d1-'));
  let storage = await schemaAdminStorage('D1', directory);
  const principal = { id: 'picker-d1', permissions: ['content:read', 'content:read_drafts', 'content:create'] };
  try {
    await migrateCms(storage.database); const registry = new SchemaRegistry(storage.database);
    await registry.createCollection({ slug: 'people', label: 'People', routable: false });
    await registry.createField('people', { slug: 'name', label: 'Name', type: 'string' });
    const writes = lifecycleService(storage.database, principal, { after: () => {} });
    for (let index = 0; index < 51; index++) await writes.createContent({ type: 'people', locale: 'en', slug: `ordinary-${index}`, data: { name: `Ordinary ${index}` } });
    await writes.createContent({ type: 'people', locale: 'fr', slug: 'needle', data: { name: '50% Needle' } });
    let reads = contentPickerService(storage.database, principal);
    const first = await reads.list('people', { limit: 50 }); assert.equal(first.items.length, 50); assert.equal(typeof first.nextCursor, 'string');
    const second = await reads.list('people', { limit: 50, cursor: first.nextCursor }); assert.equal(second.items.length, 2);
    const all = [...first.items, ...second.items]; assert.equal(new Set(all.map(item => item.id)).size, 52); assert.deepEqual(new Set(all.map(item => item.locale)), new Set(['en', 'fr']));
    await storage.close(); storage = await schemaAdminStorage('D1', directory); reads = contentPickerService(storage.database, principal);
    const after = await reads.list('people', { q: '50%' }); assert.equal(after.total, 1); assert.equal(after.items[0].data.name, '50% Needle'); assert.equal(after.items[0].locale, 'fr');
  } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
});
