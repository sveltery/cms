import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Miniflare } from 'miniflare';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { installHistoricalCanonical5 } from './helpers/historical-canonical5.ts';
import { menuSchemaStatements } from '../src/lib/server/menus/migrations.ts';
import { handleMenuCreate, handleMenuSetItems, handleMenuItemReorder, handleMenuDelete } from '../src/lib/server/menus/handlers.ts';
import type { Database } from '../src/lib/server/menus/database-types.ts';

// Original real raw-binding D1 requirements, zero Source callback credit.
async function fixture() {
  const worker = new Miniflare({ modules: true,
    script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { CMS_DB: 'cms-menu-native-fixture' }, cf: false });
  const storage = openD1(await worker.getD1Database('CMS_DB'));
  await installHistoricalCanonical5(storage);
  await storage.atomicBatch(menuSchemaStatements(storage));
  return { storage, worker, db: storage.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>() };
}

test('real D1 menu create succeeds and persists', { timeout: 30_000 }, async () => {
  const { storage, worker, db } = await fixture();
  try {
    const result = await handleMenuCreate(db, { name: 'primary', label: 'Primary' });
    assert.equal(result.success, true);
    const rows = await db.selectFrom('_cms_menus').selectAll().execute();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.translation_group, rows[0]?.id);
  } finally { await storage.close(); await worker.dispose(); }
});

test('real D1 atomic replacement preserves hierarchy and removes old rows', { timeout: 30_000 }, async () => {
  const { storage, worker, db } = await fixture();
  try {
    await db.insertInto('_cms_menus').values({ id: 'menu', name: 'primary', label: 'Primary', translation_group: 'menu' }).execute();
    await db.insertInto('_cms_menu_items').values({ id: 'old', menu_id: 'menu', label: 'Old', type: 'custom', sort_order: 0,
      parent_id: null, reference_collection: null, reference_id: null, custom_url: '/old', title_attr: null, target: null, css_classes: null, translation_group: 'old' }).execute();
    const result = await handleMenuSetItems(db, 'primary', [
      { label: 'Root', type: 'custom', customUrl: '/' },
      { label: 'Child', type: 'custom', customUrl: '/child', parentIndex: 0 }
    ]);
    assert.equal(result.success, true);
    const rows = await db.selectFrom('_cms_menu_items').selectAll().orderBy('sort_order').execute();
    assert.deepEqual(rows.map(row => row.label), ['Root', 'Child']);
    assert.equal(rows[1]?.parent_id, rows[0]?.id);
    assert.ok(rows.every(row => row.translation_group === row.id));
  } finally { await storage.close(); await worker.dispose(); }
});

test('real D1 translation cloning retains logical item groups and parent links', { timeout: 30_000 }, async () => {
  const { storage, worker, db } = await fixture();
  try {
    await db.insertInto('_cms_menus').values({ id: 'menu', name: 'primary', label: 'Primary', translation_group: 'menu' }).execute();
    await db.insertInto('_cms_menu_items').values({ id: 'parent', menu_id: 'menu', label: 'Root', type: 'custom', sort_order: 0,
      parent_id: null, reference_collection: null, reference_id: null, custom_url: '/', title_attr: null, target: null, css_classes: null, translation_group: 'parent' }).execute();
    await db.insertInto('_cms_menu_items').values({ id: 'child', menu_id: 'menu', label: 'Child', type: 'custom', sort_order: 1,
      parent_id: 'parent', reference_collection: null, reference_id: null, custom_url: '/child', title_attr: null, target: null, css_classes: null, translation_group: 'child' }).execute();
    const result = await handleMenuCreate(db, { name: 'primary', label: 'Principal', locale: 'fr', translationOf: 'menu' });
    assert.equal(result.success, true);
    const rows = await db.selectFrom('_cms_menu_items').selectAll().where('locale', '=', 'fr').orderBy('sort_order').execute();
    assert.deepEqual(rows.map(row => row.translation_group), ['parent', 'child']);
    assert.equal(rows[1]?.parent_id, rows[0]?.id);
    assert.ok(rows.every(row => row.menu_id !== 'menu'));
  } finally { await storage.close(); await worker.dispose(); }
});

test('real D1 reorder and explicit menu deletion persist without cascade FKs', { timeout: 30_000 }, async () => {
  const { storage, worker, db } = await fixture();
  try {
    await db.insertInto('_cms_menus').values({ id: 'menu', name: 'primary', label: 'Primary', translation_group: 'menu' }).execute();
    await db.insertInto('_cms_menu_items').values({ id: 'item', menu_id: 'menu', label: 'Item', type: 'custom', sort_order: 0,
      parent_id: null, reference_collection: null, reference_id: null, custom_url: '/', title_attr: null, target: null, css_classes: null, translation_group: 'item' }).execute();
    const reordered = await handleMenuItemReorder(db, 'primary', [{ id: 'item', parentId: null, sortOrder: 4 }]);
    assert.equal(reordered.success, true);
    assert.equal((await db.selectFrom('_cms_menu_items').select('sort_order').executeTakeFirst())?.sort_order, 4);
    const deleted = await handleMenuDelete(db, 'primary');
    assert.equal(deleted.success, true);
    assert.deepEqual(await db.selectFrom('_cms_menu_items').selectAll().execute(), []);
    assert.deepEqual(await db.selectFrom('_cms_menus').selectAll().execute(), []);
  } finally { await storage.close(); await worker.dispose(); }
});
