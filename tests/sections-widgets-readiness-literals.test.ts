// Original actual-database readiness requirements; no copied Source callback credit.
// Reviewed against the pinned Source final sections DDL, including source DEFAULT 'user'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { sectionSchemaStatements } from '../src/lib/server/sections-widgets/schema.ts';
import { requireSectionWidgetStorage, SectionWidgetStorageUnavailable } from '../src/lib/server/sections-widgets/readiness.ts';

const literals = [
  { name: 'double quotes remain inside a different SQL default literal', literal: `'"user"'` },
  { name: 'literal case remains significant', literal: `'USER'` },
  { name: 'literal whitespace remains significant', literal: `' user '` },
  { name: 'doubled single-quote escaping remains inside the literal', literal: `'u''"ser"'` }
] as const;
for (const target of ['Node', 'D1'] as const) {
  for (const { name, literal } of literals) test(`${target}: sections readiness rejects when ${name}`, async t => {
    const storage = await schemaAdminStorage(target); t.after(() => storage.close());
    const db = storage.database.db;
    for (const statement of sectionSchemaStatements(db)) {
      await sql.raw(statement.sql.replace("default 'user'", `default ${literal}`)).execute(db);
    }
    const source = (await sql<{ name: string; dflt_value: string }>`PRAGMA table_info(_cms_sections)`.execute(db)).rows.find(column => column.name === 'source');
    assert.equal(source?.dflt_value, literal);
    await assert.rejects(requireSectionWidgetStorage(db, 'sections'), SectionWidgetStorageUnavailable);
    assert.equal((await sql<{ name: string; dflt_value: string }>`PRAGMA table_info(_cms_sections)`.execute(db)).rows.find(column => column.name === 'source')?.dflt_value, literal);
  });
  test(`${target}: sections readiness accepts CREATE keyword case, identifier quoting and outside-literal whitespace`, async t => {
    const storage = await schemaAdminStorage(target); t.after(() => storage.close());
    const db = storage.database.db;
    for (const statement of sectionSchemaStatements(db)) {
      const formatting = statement.sql.replace(/^create (table|index)/, match => match.toUpperCase()).replace(/"([\w]+)"/g, '$1').replaceAll(', ', ',\n  ');
      await sql.raw(formatting).execute(db);
    }
    assert.equal((await sql<{ name: string; dflt_value: string }>`PRAGMA table_info(_cms_sections)`.execute(db)).rows.find(column => column.name === 'source')?.dflt_value, "'user'");
    await assert.doesNotReject(requireSectionWidgetStorage(db, 'sections'));
  });
}
