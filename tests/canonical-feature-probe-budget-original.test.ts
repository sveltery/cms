// Whole Original real-storage startup-query controls. No simulated marker rows.
// Unmapped descriptors are declarations, not substitute installed providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import type { CmsMigrationProvider } from '../src/lib/server/database/migration-provider.ts';
import { CMS_MIGRATIONS } from '../src/lib/server/database/migrations.ts';
import { mediaAttributionMigration, directedRelationsMigration, menusMigration,
  sectionsWidgetsStorageMigration, commentsMigration, redirectsMigration } from '../src/lib/server/database/canonical-features/providers.ts';
import { featureStartupProbe } from '../src/lib/server/database/canonical-features/startup-probe.ts';
import { historicalFeatureStorage } from './helpers/canonical-feature-storage-original.ts';

type DeclaredProvider = CmsMigrationProvider & {
  expectedTriggers?(database: CmsDatabase): Promise<readonly { name: string; type: 'trigger'; sql: string }[]>;
};
const features: readonly DeclaredProvider[] = [mediaAttributionMigration, directedRelationsMigration,
  menusMigration, sectionsWidgetsStorageMigration, commentsMigration, redirectsMigration];
const providers: readonly DeclaredProvider[] = [...CMS_MIGRATIONS,
  ...features.filter(feature => !CMS_MIGRATIONS.some(installed => installed.version === feature.version))];
const compare = (a: { name: string; type: string }, b: { name: string; type: string }) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.type < b.type ? -1 : a.type > b.type ? 1 : 0;

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${mode}: complete declared startup census fits D1's100-bind budget and preserves real namespace values`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode, 0);
    try {
      const names = new Set(['_cms_migrations']), triggers = new Set<string>();
      for (const provider of providers) {
        for (const object of await provider.expectedObjects(fixture.database, 0)) names.add(object.name.toLowerCase());
        for (const trigger of await provider.expectedTriggers?.(fixture.database) ?? []) triggers.add(trigger.name.toLowerCase());
      }
      await fixture.database.atomicBatch([...await menusMigration.statements(fixture.database),
        ...await sectionsWidgetsStorageMigration.statements(fixture.database),
        sql`CREATE TABLE operator_notes(note TEXT)`.compile(fixture.database.db),
        sql`CREATE TABLE _cms_operator_visible(note TEXT)`.compile(fixture.database.db),
        // SQLite tables and triggers legitimately share this exact name.
        sql`CREATE TABLE EMDASH_MEDIA_USAGE_FENCE_SOURCE_GENERATION_INSERT(note TEXT)`.compile(fixture.database.db),
        sql`CREATE TRIGGER EMDASH_MEDIA_USAGE_FENCE_SOURCE_GENERATION_INSERT AFTER INSERT ON operator_notes
          BEGIN UPDATE operator_notes SET note='ordinary'; END`.compile(fixture.database.db)
      ]);
      const query = featureStartupProbe(fixture.database, [...names], [...triggers]);
      assert.ok(query.parameters.length <= 100, `real startup probe uses ${query.parameters.length} bindings, exceeding D1's100 limit`);
      const wanted = [...await menusMigration.expectedObjects(fixture.database, 0),
        ...await sectionsWidgetsStorageMigration.expectedObjects(fixture.database, 0)]
        .map(({ name, type }) => ({ name, type: type as string }));
      wanted.push({ name: '_cms_operator_visible', type: 'table' },
        { name: 'EMDASH_MEDIA_USAGE_FENCE_SOURCE_GENERATION_INSERT', type: 'trigger' });
      const actual = await fixture.database.db.executeQuery(query);
      // Node sqlite returns null-prototype records; compare the exact projected
      // census values consistently with raw/scoped D1's plain records.
      assert.deepEqual(actual.rows.map(({ name, type }) => ({ name, type })).toSorted(compare), wanted.toSorted(compare));
      assert.equal(actual.rows.some(row => row.name === 'EMDASH_MEDIA_USAGE_FENCE_SOURCE_GENERATION_INSERT' && row.type === 'table'), false);
    } finally { await fixture.close(); }
  });
}
