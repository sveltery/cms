// Original real-database timestamp semantics; no copied Source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { sectionSchemaStatements, widgetSchemaStatements } from '../src/lib/server/sections-widgets/schema.ts';
import { requireSectionWidgetStorage, SectionWidgetStorageUnavailable } from '../src/lib/server/sections-widgets/readiness.ts';

for (const target of ['Node', 'D1'] as const) for (const family of ['sections', 'widgets'] as const) {
  test(`${target}: ${family} readiness rejects a quoted timestamp literal in place of the Source expression`, async t => {
    const storage = await schemaAdminStorage(target); t.after(() => storage.close());
    const db = storage.database.db;
    for (const statement of (family === 'sections' ? sectionSchemaStatements : widgetSchemaStatements)(db)) {
      await sql.raw(statement.sql.replaceAll('default CURRENT_TIMESTAMP', 'default "CURRENT_TIMESTAMP"')).execute(db);
    }
    if (family === 'sections') await sql`INSERT INTO _cms_sections (id,slug,title,content) VALUES ('timestamp','timestamp','Timestamp','[]')`.execute(db);
    else await sql`INSERT INTO _cms_widget_areas (id,name,label) VALUES ('timestamp','timestamp','Timestamp')`.execute(db);
    const rows = family === 'sections'
      ? await sql<{ created_at: string; updated_at: string }>`SELECT created_at,updated_at FROM _cms_sections WHERE id='timestamp'`.execute(db)
      : await sql<{ created_at: string }>`SELECT created_at FROM _cms_widget_areas WHERE id='timestamp'`.execute(db);
    assert.equal(rows.rows[0].created_at, 'CURRENT_TIMESTAMP');
    if ('updated_at' in rows.rows[0]) assert.equal(rows.rows[0].updated_at, 'CURRENT_TIMESTAMP');
    await assert.rejects(requireSectionWidgetStorage(db, family), SectionWidgetStorageUnavailable);
    const metadata = await sql<{ name: string; dflt_value: string }>`SELECT name,dflt_value FROM pragma_table_info(${family === 'sections' ? '_cms_sections' : '_cms_widget_areas'}) WHERE name='created_at'`.execute(db);
    assert.equal(metadata.rows[0].dflt_value, '"CURRENT_TIMESTAMP"');
  });
}

for (const target of ['Node', 'D1'] as const) for (const family of ['sections', 'widgets'] as const) {
  test(`${target}: ${family} readiness rejects non-SQLite NBSP that swallows a timestamp default into the column type`, async t => {
    const storage = await schemaAdminStorage(target); t.after(() => storage.close());
    const db = storage.database.db;
    for (const statement of (family === 'sections' ? sectionSchemaStatements : widgetSchemaStatements)(db)) {
      await sql.raw(statement.sql.replace('text default CURRENT_TIMESTAMP', 'text\u00a0default CURRENT_TIMESTAMP')).execute(db);
    }
    const metadata = await sql<{ name: string; type: string; dflt_value: string | null }>`SELECT name,type,dflt_value FROM pragma_table_info(${family === 'sections' ? '_cms_sections' : '_cms_widget_areas'}) WHERE name='created_at'`.execute(db);
    assert.equal(metadata.rows[0].type, 'text\u00a0default CURRENT_TIMESTAMP');
    assert.equal(metadata.rows[0].dflt_value, null);
    await assert.rejects(requireSectionWidgetStorage(db, family), SectionWidgetStorageUnavailable);
  });
}
