import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Kysely, sql } from 'kysely';
import { Miniflare } from 'miniflare';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1, SessionD1Dialect } from '../src/lib/server/database/d1.ts';
import { installHistoricalCanonical5 } from './helpers/historical-canonical5.ts';
import { menuSchemaStatements } from '../src/lib/server/menus/migrations.ts';
import { MenuRepository, MenuGoneError } from '../src/lib/server/menus/repository.ts';
import type { Database } from '../src/lib/server/menus/database-types.ts';
import type { CmsTables } from '../src/lib/server/database/contract.ts';

// Original storage contracts on real SQL. No authentication/concurrency probes
// and zero Source callback or canonical startup credit.
async function fixture(backend: 'node' | 'raw-d1' | 'scoped-d1') {
  const worker = backend === 'node' ? undefined : new Miniflare({ modules: true,
    script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { CMS_DB: 'cms-menu-atomic-fixture' }, cf: false });
  const binding = await worker?.getD1Database('CMS_DB');
  const storage = binding ? openD1(binding) : openSqlite(':memory:');
  await installHistoricalCanonical5(storage);
  await storage.atomicBatch(menuSchemaStatements(storage));
  const scoped = backend === 'scoped-d1' ? new Kysely<CmsTables>({ dialect: new SessionD1Dialect({ database: binding! }) }) : undefined;
  const db = (scoped ?? storage.db).withTables<{[Name in keyof Database]: Database[Name]}>().$pickTables<keyof Database>();
  const repo = new MenuRepository(db);
  return { db, repo, storage, async close() { await scoped?.destroy(); await storage.close(); await worker?.dispose(); } };
}

for (const backend of ['node', 'raw-d1', 'scoped-d1'] as const) {
  test(`${backend}: replacing items rolls back deletion and partial insertion on SQL failure`, { timeout: 30_000 }, async () => {
    const f = await fixture(backend);
    try {
      const menu = await f.repo.create({ name: 'primary', label: 'Primary' });
      await f.repo.createItem(menu.id, 'en', { label: 'Original', type: 'custom', customUrl: '/original' });
      const before = await f.repo.findItems(menu.id);
      await sql`CREATE TRIGGER reject_menu_item BEFORE INSERT ON _cms_menu_items
        WHEN NEW.label = 'Reject' BEGIN SELECT RAISE(ABORT, 'menu fixture rejects item'); END`.execute(f.db);
      await assert.rejects(f.repo.setItems(menu.id, 'en', [
        { label: 'Accepted', type: 'custom', customUrl: '/' },
        { label: 'Reject', type: 'custom', customUrl: '/reject' }
      ]), /menu fixture rejects item/);
      assert.deepEqual(await f.repo.findItems(menu.id), before);
      assert.deepEqual((await sql`SELECT * FROM _cms_guards`.execute(f.db)).rows, []);
    } finally { await f.close(); }
  });

  test(`${backend}: an absent menu cannot receive orphan items`, { timeout: 30_000 }, async () => {
    const f = await fixture(backend);
    try {
      await assert.rejects(f.repo.setItems('gone', 'en', [{ label: 'Orphan', type: 'custom' }]), MenuGoneError);
      assert.deepEqual(await f.db.selectFrom('_cms_menu_items').selectAll().execute(), []);
      assert.deepEqual((await sql`SELECT * FROM _cms_guards`.execute(f.db)).rows, []);
    } finally { await f.close(); }
  });

  test(`${backend}: reordering ignores foreign menu items and retains the requested menu scope`, { timeout: 30_000 }, async () => {
    const f = await fixture(backend);
    try {
      const own = await f.repo.create({ name: 'primary', label: 'Primary' });
      const foreign = await f.repo.create({ name: 'footer', label: 'Footer' });
      const ownItem = await f.repo.createItem(own.id, 'en', { label: 'Own', type: 'custom' });
      const foreignItem = await f.repo.createItem(foreign.id, 'en', { label: 'Foreign', type: 'custom' });
      const result = await f.repo.reorderItems(own.id, [
        { id: ownItem.id, parentId: null, sortOrder: 4 },
        { id: foreignItem.id, parentId: null, sortOrder: 9 }
      ]);
      assert.deepEqual(result.map(item => [item.id, item.sortOrder]), [[ownItem.id, 4]]);
      assert.deepEqual((await f.repo.findItems(foreign.id)).map(item => [item.id, item.sortOrder]), [[foreignItem.id, 0]]);
    } finally { await f.close(); }
  });

  test(`${backend}: a failed reorder rolls back earlier updates in the same operation`, { timeout: 30_000 }, async () => {
    const f = await fixture(backend);
    try {
      const menu = await f.repo.create({ name: 'primary', label: 'Primary' });
      const first = await f.repo.createItem(menu.id, 'en', { label: 'First', type: 'custom' });
      const second = await f.repo.createItem(menu.id, 'en', { label: 'Second', type: 'custom' });
      const before = await f.repo.findItems(menu.id);
      await sql`CREATE TRIGGER reject_menu_reorder BEFORE UPDATE OF sort_order ON _cms_menu_items
        WHEN NEW.sort_order = 99 BEGIN SELECT RAISE(ABORT, 'menu fixture rejects reorder'); END`.execute(f.db);
      await assert.rejects(f.repo.reorderItems(menu.id, [
        { id: first.id, parentId: null, sortOrder: 4 },
        { id: second.id, parentId: null, sortOrder: 99 }
      ]), /menu fixture rejects reorder/);
      assert.deepEqual(await f.repo.findItems(menu.id), before);
    } finally { await f.close(); }
  });

  test(`${backend}: cloning failure leaves neither a partial translation nor cloned items`, { timeout: 30_000 }, async () => {
    const f = await fixture(backend);
    try {
      const menu = await f.repo.create({ name: 'primary', label: 'Primary' });
      await f.repo.createItem(menu.id, 'en', { label: 'First', type: 'custom' });
      await f.repo.createItem(menu.id, 'en', { label: 'Second', type: 'custom' });
      await sql`CREATE TRIGGER reject_menu_clone BEFORE INSERT ON _cms_menu_items
        WHEN NEW.locale = 'fr' AND NEW.label = 'Second' BEGIN SELECT RAISE(ABORT, 'menu fixture rejects clone'); END`.execute(f.db);
      await assert.rejects(f.repo.create({ name: 'primary', label: 'Principal', locale: 'fr', translationOf: menu.id }), /menu fixture rejects clone/);
      assert.equal((await f.repo.findByName('primary')).length, 1);
      assert.deepEqual(await f.db.selectFrom('_cms_menu_items').selectAll().where('locale', '=', 'fr').execute(), []);
    } finally { await f.close(); }
  });

  test(`${backend}: replacing one locale leaves the other translation intact`, { timeout: 30_000 }, async () => {
    const f = await fixture(backend);
    try {
      const en = await f.repo.create({ name: 'primary', label: 'Primary', locale: 'en' });
      const item = await f.repo.createItem(en.id, 'en', { label: 'English', type: 'custom' });
      const fr = await f.repo.create({ name: 'primary', label: 'Principal', locale: 'fr', translationOf: en.id });
      await f.repo.setItems(fr.id, 'fr', [{ label: 'French', type: 'custom' }]);
      assert.deepEqual((await f.repo.findItems(en.id)).map(value => [value.id, value.label, value.locale]), [[item.id, 'English', 'en']]);
      assert.deepEqual((await f.repo.findItems(fr.id)).map(value => [value.label, value.locale]), [['French', 'fr']]);
    } finally { await f.close(); }
  });
}

// Ordinary SQL triggers change the source within a single batch. These cases
// verify the native guarded-snapshot contract, not Source latest-read parity
// or concurrent/protected request behavior.
for (const backend of ['raw-d1', 'scoped-d1'] as const) {
  for (const [change, statement] of [
    ['edited item', "UPDATE _cms_menu_items SET label = 'Changed' WHERE label = 'Source'"],
    ['moved item', "UPDATE _cms_menu_items SET menu_id = 'other' WHERE label = 'Source'"],
    ['reordered item', "UPDATE _cms_menu_items SET sort_order = 99 WHERE label = 'Source'"],
    ['deleted source', "DELETE FROM _cms_menus WHERE locale = 'en'"]
  ] as const) {
    test(`${backend}: cloning refuses a source ${change} during its batch`, { timeout: 30_000 }, async () => {
      const f = await fixture(backend);
      try {
        const menu = await f.repo.create({ name: 'primary', label: 'Primary', locale: 'en' });
        await f.repo.createItem(menu.id, 'en', { label: 'Source', type: 'custom' });
        const beforeMenus = await f.db.selectFrom('_cms_menus').selectAll().execute();
        const beforeItems = await f.db.selectFrom('_cms_menu_items').selectAll().execute();
        await sql.raw(`CREATE TRIGGER change_menu_clone_source BEFORE INSERT ON _cms_menus
          WHEN NEW.locale = 'fr' BEGIN ${statement}; END`).execute(f.db);
        await assert.rejects(f.repo.create({ name: 'primary', label: 'Principal', locale: 'fr', translationOf: menu.id }), /Source menu .* changed before cloning/);
        assert.deepEqual(await f.db.selectFrom('_cms_menus').selectAll().execute(), beforeMenus);
        assert.deepEqual(await f.db.selectFrom('_cms_menu_items').selectAll().execute(), beforeItems);
        assert.deepEqual((await sql`SELECT * FROM _cms_guards`.execute(f.db)).rows, []);
      } finally { await f.close(); }
    });
  }
}
