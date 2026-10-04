// Whole Original native host-boundary value requirements, not copied Source cases.
// Named genuine Source001/036/077 native physical fixtures;0canonical credit.
// Ordinary single trusted principal only; no auth/session/signature/race probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql, type Kysely } from 'kysely';
import { historicalFeatureStorage, type StorageMode } from './helpers/canonical-feature-storage-original.ts';
import { menuSchemaStatements } from '../src/lib/server/menus/migrations.ts';
import { MenuRepository } from '../src/lib/server/menus/repository.ts';
import type { Database as MenuDatabase } from '../src/lib/server/menus/database-types.ts';
import { getMenuWithDb } from '../src/lib/server/menus/index.ts';
import { getDb } from '../src/lib/server/menus/loader.ts';
import { runWithContext } from '../src/lib/server/menus/context.ts';
import { installRedirectTables } from '../src/lib/server/redirects/migrations/index.ts';
import { redirectEndpoint } from '../src/lib/server/redirects/request.ts';
import { servicePrincipal } from '../src/lib/server/auth/composition.ts';
import { Role } from '../src/lib/server/auth/roles.ts';

async function namespaceFixture(mode: StorageMode) {
  const fixture = await historicalFeatureStorage(mode);
  try {
    await fixture.database.atomicBatch(menuSchemaStatements(fixture.database));
    await installRedirectTables(fixture.database.db as unknown as Kysely<unknown>);
    // Complete Source036 term shape and Source001→077 options shape under
    // the planned actual native namespaces; no bare alias table/view is added.
    await sql`CREATE TABLE _cms_taxonomies (id TEXT PRIMARY KEY, name TEXT NOT NULL,
      slug TEXT NOT NULL, label TEXT NOT NULL, parent_id TEXT, data TEXT,
      locale TEXT NOT NULL DEFAULT 'en', translation_group TEXT, UNIQUE(name,slug,locale),
      FOREIGN KEY(parent_id) REFERENCES _cms_taxonomies(id) ON DELETE SET NULL)`.execute(fixture.database.db);
    await sql`CREATE TABLE _cms_options (name TEXT PRIMARY KEY, value TEXT NOT NULL,
      revision TEXT NOT NULL DEFAULT '0')`.execute(fixture.database.db);
    await sql`CREATE TRIGGER emdash_options_revision_insert AFTER INSERT ON _cms_options
      WHEN NEW.revision='0' BEGIN UPDATE _cms_options SET revision=lower(hex(randomblob(16)))
      WHERE name=NEW.name AND revision=NEW.revision; END`.execute(fixture.database.db);
    await sql`CREATE TRIGGER emdash_options_revision_update AFTER UPDATE ON _cms_options
      WHEN NEW.revision='0' OR NEW.revision=OLD.revision BEGIN UPDATE _cms_options
      SET revision=lower(hex(randomblob(16))) WHERE name=NEW.name AND revision=NEW.revision; END`.execute(fixture.database.db);
    return fixture;
  } catch (error) { await fixture.close(); throw error; }
}

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${mode}: actual redirect host persists its Source loop cache in canonical options`, { timeout: 90_000 }, async () => {
    const fixture = await namespaceFixture(mode);
    try {
      const principal = servicePrincipal({ id: 'ordinary-feature-admin', role: Role.ADMIN }); assert.ok(principal);
      const url = new URL('https://ordinary-feature-host.invalid/api/redirects');
      const response = await redirectEndpoint({ url, request: new Request(url), params: {},
        locals: { cms: { database: fixture.database, principal, mutationsEnabled: true } } }, 'list');
      assert.equal(response.status, 200);
      const options = (await sql<{ name: string; value: string }>`SELECT name,value FROM _cms_options WHERE name='_redirect_loop_ids'`
        .execute(fixture.database.db)).rows;
      assert.deepEqual(options, [{ name: '_redirect_loop_ids', value: '[]' }]);
      assert.deepEqual((await sql`SELECT name FROM sqlite_master WHERE name='options'`.execute(fixture.database.db)).rows, []);
    } finally { await fixture.close(); }
  });
  test(`${mode}: actual menu loader resolves a real canonical taxonomy term`, { timeout: 90_000 }, async () => {
    const fixture = await namespaceFixture(mode);
    try {
      await sql`INSERT INTO _cms_taxonomies (id,name,slug,label,locale,translation_group)
        VALUES ('ordinary-news-term','category','news','News','en','ordinary-news-group')`.execute(fixture.database.db);
      const db = fixture.database.db.withTables<{ [Name in keyof MenuDatabase]: MenuDatabase[Name] }>().$pickTables<keyof MenuDatabase>();
      const repository = new MenuRepository(db);
      const menu = await repository.create({ name: 'primary', label: 'Primary' });
      await repository.createItem(menu.id, 'en', { type: 'taxonomy', label: 'News', referenceId: 'ordinary-news-group' });
      const rendered = await runWithContext({ db, locale: 'en', editMode: false }, async () =>
        getMenuWithDb('primary', await getDb(), { locale: 'en' }));
      assert.ok(rendered);
      assert.deepEqual(rendered.items.map(item => ({ label: item.label, url: item.url })), [{ label: 'News', url: '/category/news' }]);
      assert.deepEqual((await sql`SELECT name FROM sqlite_master WHERE name='taxonomies'`.execute(fixture.database.db)).rows, []);
    } finally { await fixture.close(); }
  });
}
