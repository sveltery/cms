import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { editorManifest } from '../../src/lib/server/content/manifest.ts';
import type { ServerPrincipal } from '../../src/lib/server/database/service.ts';

// Original ordinary-domain integration requirements; no copied Source test credit.
// Identity is a fixed stored principal. These tests do not create or probe sessions.
const actor: ServerPrincipal = { id: 'seed-fixed-stored-admin', permissions: [
  'content:create', 'content:read', 'content:read_drafts', 'content:edit_own', 'content:publish_own'
] };
const expected = (item: { version: number; updatedAt: string }) => ({ version: item.version, updatedAt: item.updatedAt });
const data = Object.fromEntries(Array.from({ length: 74 }, (_, index) => [`field_${index}`, `Value ${index}`]));

for (const target of ['Node', 'D1'] as const) it(`${target}: publishes, stages and reopens all 74 fields and their metadata`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'source-seed-lifecycle-'));
  let storage = await schemaAdminStorage(target, directory);
  const deferred: Array<() => void | Promise<void>> = [];
  try {
    await migrateCms(storage.database);
    await storage.database.db.insertInto('_cms_auth_users').values({ id: actor.id, role: 40, disabled: 0 }).execute();
    const registry = new SchemaRegistry(storage.database);
    const collection = await registry.createCollection({ slug: 'site_info', label: 'Site Info', source: 'seed' });
    // Independent real storage reaches lifecycle assertions before bulk creation exists.
    for (let index = 0; index < 74; index++) {
      await sql`ALTER TABLE ec_site_info ADD COLUMN ${sql.ref(`field_${index}`)} TEXT`.execute(storage.database.db);
      await storage.database.db.insertInto('_cms_fields').values({ id: `field_${index}`, collection_id: collection.id,
        slug: `field_${index}`, label: `Field ${index}`, type: 'string', column_type: 'TEXT', required: Number(index === 73),
        unique: 0, default_value: null, validation: null, sort_order: index, created_at: collection.createdAt }).execute();
    }
    const service = lifecycleService(storage.database, actor, { after: task => deferred.push(task) });
    const creation = await service.createContent({ type: 'site_info', slug: 'canonical', data })
      .then(item => ({ item, error: null }), error => ({ item: null, error }));
    expect(creation.error, 'the public data-key cap is an actual lifecycle behavioral red').toBeNull();
    const initial = creation.item!;
    expect(initial.data).toEqual(data);
    const key = { type: 'site_info', id: initial.id };
    const published = await service.publish({ ...key, expected: expected(initial) });
    expect((await service.readPublished(key))?.data).toEqual(data);
    const stagedData = { ...data, field_73: 'Updated last field' };
    const staged = (await service.updateContent({ ...key, expected: expected(published), data: stagedData })).item;
    expect(staged.data).toEqual(stagedData);
    expect((await service.readPublished(key))?.data).toEqual(data);
    const republished = await service.publish({ ...key, expected: expected(staged) });
    expect((await service.readPublished(key))?.data).toEqual(stagedData);
    await registry.updateField('site_info', 'field_73', { label: 'Last field persisted', sortOrder: 73 });
    for (const task of deferred.splice(0)) await task();
    await storage.close();
    storage = await schemaAdminStorage(target, directory);
    const startupError = await migrateCms(storage.database).then(() => null, error => error);
    expect(startupError, 'startup must recognize the complete published collection').toBeNull();
    const reopened = lifecycleService(storage.database, actor);
    expect(await reopened.getContent(key)).toEqual(republished);
    expect((await reopened.readPublished(key))?.data).toEqual(stagedData);
    const reopenedRegistry = new SchemaRegistry(storage.database);
    expect((await reopenedRegistry.getCollectionWithFields('site_info'))?.fields).toHaveLength(74);
    expect((await reopenedRegistry.getField('site_info', 'field_73'))?.label).toBe('Last field persisted');
    const manifest = await editorManifest(storage.database, actor);
    expect(Object.keys(manifest.collections.site_info.fields)).toHaveLength(74);
    expect(manifest.collections.site_info.fields.field_73.label).toBe('Last field persisted');
    expect(await storage.database.db.selectFrom('_cms_auth_users').selectAll().execute()).toEqual([
      { id: actor.id, role: 40, disabled: 0 }
    ]);
  } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
}, 90000);
