// Original final Source schema requirement; zero Source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { sourceNamespace } from './helpers/sections-widgets-namespace.ts';
import { up as createSections } from '../parity/emdash/sections-widgets-source/upstream/packages/core/src/database/migrations/011_sections.ts';
import { up as removeCategories } from '../parity/emdash/sections-widgets-source/upstream/packages/core/src/database/migrations/021_remove_section_categories.ts';
import { requireSectionWidgetStorage } from '../src/lib/server/sections-widgets/readiness.ts';
for (const target of ['Node', 'D1'] as const) test(`${target}: final pinned Source021 sections are ready without obsolete category objects`, async t => {
  const storage = await schemaAdminStorage(target); t.after(() => storage.close());
  const db = storage.database.db, fixture = db.withPlugin(sourceNamespace) as unknown as Kysely<unknown>;
  await createSections(fixture); await removeCategories(fixture);
  const rows = (await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE name IN ('_cms_section_categories','idx_sections_category')`.execute(db)).rows;
  assert.deepEqual(rows, []);
  await assert.doesNotReject(requireSectionWidgetStorage(db, 'sections'));
  await db.insertInto('_cms_auth_users').values({ id: 'schema-readiness-sentinel', role: 'subscriber', disabled: 0 }).execute();
  await assert.doesNotReject(requireSectionWidgetStorage(db, 'sections'));
  assert.equal((await db.selectFrom('_cms_auth_users').select('id').where('id', '=', 'schema-readiness-sentinel').execute()).length, 1);
});
