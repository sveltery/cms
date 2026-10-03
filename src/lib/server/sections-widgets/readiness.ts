import { sql, type Kysely } from 'kysely';
import { migrationObjects } from '../database/migration-provider.ts';
import { sectionSchemaStatements, widgetSchemaStatements } from './schema.ts';
export class SectionWidgetStorageUnavailable extends Error {
  readonly code = 'MIGRATION_REQUIRED';
}
// Finite identifiers from the pinned final owned tables and indexes. Quoted
// default tokens (including "CURRENT_TIMESTAMP") are not identifiers here.
const identifiers: Record<'sections' | 'widgets', ReadonlySet<string>> = {
  sections: new Set(['_cms_sections', 'idx_sections_source', 'id', 'slug', 'title', 'description', 'keywords', 'content', 'preview_media_id', 'source', 'theme_id', 'created_at', 'updated_at']),
  widgets: new Set(['_cms_widget_areas', '_cms_widgets', 'idx_widgets_area', 'id', 'name', 'label', 'description', 'created_at', 'area_id', 'sort_order', 'type', 'title', 'content', 'menu_name', 'component_id', 'component_props'])
};
function descriptorSql(value: string, ownedIdentifiers: ReadonlySet<string>): string {
  let normalized = '', space = false;
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (/[ \t\n\r\f]/.test(character)) { space = normalized.length > 0; index++; continue; }
    if (space) { normalized += ' '; space = false; }
    if (character === "'" || character === '"') {
      const start = index++, quote = character;
      while (index < value.length) {
        if (value[index++] !== quote) continue;
        if (value[index] === quote) { index++; continue; }
        break;
      }
      const token = value.slice(start, index);
      // Only simple quoted identifiers are interchangeable with bare names.
      // Single-quoted literals, their whitespace and doubled quotes stay exact.
      normalized += quote === '"' && ownedIdentifiers.has(token.slice(1, -1)) ? token.slice(1, -1) : token;
    } else { normalized += character; index++; }
  }
  // SQLite stores CREATE keywords uppercase; keep every literal and remaining DDL token intact.
  return normalized.replace(/^create (?:unique )?(?:table|index)\b/i, token => token.toUpperCase());
}
/** Validate actual owned objects without writes, repair or implicit installation. */
export async function requireSectionWidgetStorage<DB>(db: Kysely<DB>, family: 'sections' | 'widgets'): Promise<void> {
  const expected = migrationObjects(family === 'sections' ? sectionSchemaStatements(db) : widgetSchemaStatements(db));
  const objects = await sql<{ name: string; type: string; sql: string | null }>`SELECT name,type,sql FROM sqlite_master
    WHERE name IN (${sql.join(expected.map(object => sql`${object.name}`))})`.execute(db);
  const actual = new Map(objects.rows.map(object => [object.name, object]));
  for (const object of expected) {
    const stored = actual.get(object.name);
    if (!stored || stored.type !== object.type || stored.sql === null ||
      descriptorSql(stored.sql, identifiers[family]) !== descriptorSql(object.sql, identifiers[family])) {
      throw new SectionWidgetStorageUnavailable(`Complete ${family} storage is not available`);
    }
  }
}
