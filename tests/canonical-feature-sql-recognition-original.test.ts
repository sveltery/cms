// Whole Original real SQLite schema controls. Named Source DDL fixtures only;
// zero canonical-installation or copied Source callback/assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql, type Kysely } from 'kysely';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { normalizeFeatureStorageSql } from '../src/lib/server/database/canonical-features/sql-recognition.ts';
import { sectionsWidgetsStorageMigration } from '../src/lib/server/database/canonical-features/providers.ts';
import { requireSectionWidgetStorage } from '../src/lib/server/sections-widgets/readiness.ts';
import { menuSchemaStatements } from '../src/lib/server/menus/migrations.ts';
import { menuStorageReady } from '../src/lib/server/menus/readiness.ts';
import { installRedirectTables } from '../src/lib/server/redirects/migrations/index.ts';
import { historicalFeatureStorage } from './helpers/canonical-feature-storage-original.ts';

async function storedSql(database: CmsDatabase, name: string, type: 'table' | 'index' | 'trigger') {
  return (await sql<{ sql: string }>`SELECT sql FROM sqlite_master WHERE name=${name} AND type=${type}`
    .execute(database.db)).rows[0].sql;
}
for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${mode}: actual public Sections/Widgets factory SQL recognizes its genuine persisted SQLite objects`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode, 0);
    try {
      await fixture.database.atomicBatch(await sectionsWidgetsStorageMigration.statements(fixture.database));
      await requireSectionWidgetStorage(fixture.database.db, 'sections');
      await requireSectionWidgetStorage(fixture.database.db, 'widgets');
      const expected = await sectionsWidgetsStorageMigration.expectedObjects(fixture.database, 0);
      for (const object of expected) assert.equal(normalizeFeatureStorageSql(await storedSql(fixture.database, object.name, object.type)),
        normalizeFeatureStorageSql(object.sql), `genuine stored ${object.name} must be recognized`);
    } finally { await fixture.close(); }
  });
  test(`${mode}: a real quoted timestamp default remains distinct from the public Menu expression`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode, 0);
    try {
      const expected = menuSchemaStatements(fixture.database);
      await fixture.database.atomicBatch(expected.map(statement => sql.raw(statement.sql
        .replaceAll('CURRENT_TIMESTAMP', '"CURRENT_TIMESTAMP"')).compile(fixture.database.db)));
      assert.equal(await menuStorageReady(fixture.database), false);
      const defaults = (await sql<{ name: string; dflt_value: string }>`PRAGMA table_info(_cms_menus)`
        .execute(fixture.database.db)).rows.filter(column => column.name === 'created_at' || column.name === 'updated_at');
      assert.deepEqual(defaults.map(column => column.dflt_value), ['"CURRENT_TIMESTAMP"', '"CURRENT_TIMESTAMP"']);
      assert.notEqual(normalizeFeatureStorageSql(await storedSql(fixture.database, '_cms_menus', 'table')),
        normalizeFeatureStorageSql(expected[0].sql));
    } finally { await fixture.close(); }
  });
  test(`${mode}: an actual Redirect trigger retains its observable literal whitespace`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode, 0);
    try {
      await installRedirectTables(fixture.database.db as unknown as Kysely<unknown>);
      const name = 'emdash_redirect_fence_insert';
      const expected = await storedSql(fixture.database, name, 'trigger');
      await fixture.database.atomicBatch([
        sql`DROP TRIGGER ${sql.id(name)}`.compile(fixture.database.db),
        sql.raw(expected.replace("'redirect write lease expired'", "'redirect  write lease expired'"))
          .compile(fixture.database.db)
      ]);
      await assert.rejects(() => sql`INSERT INTO _cms_redirects (id,source,destination,write_generation)
        VALUES ('ordinary-redirect','/ordinary-from','/ordinary-to',1)`.execute(fixture.database.db), /redirect  write lease expired/);
      assert.notEqual(normalizeFeatureStorageSql(await storedSql(fixture.database, name, 'trigger')),
        normalizeFeatureStorageSql(expected));
    } finally { await fixture.close(); }
  });
}
