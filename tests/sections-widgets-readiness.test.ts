// Original storage availability requirements; no copied Source assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { sourceNamespace } from './helpers/sections-widgets-namespace.ts';
import { up as widgets } from '../parity/emdash/sections-widgets-source/upstream/packages/core/src/database/migrations/007_widgets.ts';
import { up as sections } from '../parity/emdash/sections-widgets-source/upstream/packages/core/src/database/migrations/011_sections.ts';
import { requireSectionWidgetStorage, SectionWidgetStorageUnavailable } from '../src/lib/server/sections-widgets/readiness.ts';
for (const target of ['Node', 'D1'] as const) test(`${target}: actual complete Source DDL is ready and absent/partial storage is never silently installed`, async t => {
  const storage = await schemaAdminStorage(target); t.after(() => storage.close());
  const db = storage.database.db;
  await assert.rejects(requireSectionWidgetStorage(db, 'sections'), SectionWidgetStorageUnavailable);
  await assert.rejects(requireSectionWidgetStorage(db, 'widgets'), SectionWidgetStorageUnavailable);
  assert.equal((await sql<{ count: number }>`SELECT count(*) AS count FROM sqlite_master WHERE name LIKE '_cms_section%' OR name LIKE '_cms_widget%'`.execute(db)).rows[0].count, 0);
  const fixture = db.withPlugin(sourceNamespace) as unknown as Kysely<unknown>;
  await sections(fixture); await widgets(fixture);
  await assert.doesNotReject(requireSectionWidgetStorage(db, 'sections'));
  await assert.doesNotReject(requireSectionWidgetStorage(db, 'widgets'));
  await sql`DROP INDEX idx_sections_source`.execute(db);
  await assert.rejects(requireSectionWidgetStorage(db, 'sections'), SectionWidgetStorageUnavailable);
  assert.equal((await sql<{ count: number }>`SELECT count(*) AS count FROM sqlite_master WHERE name='idx_sections_source'`.execute(db)).rows[0].count, 0);
  await sql`DROP TABLE _cms_widgets`.execute(db);
  await assert.rejects(requireSectionWidgetStorage(db, 'widgets'), SectionWidgetStorageUnavailable);
});
