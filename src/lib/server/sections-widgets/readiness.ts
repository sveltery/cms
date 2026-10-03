import { sql, type Kysely } from 'kysely';
import { migrationObjects } from '../database/migration-provider.ts';
import { sectionSchemaStatements, widgetSchemaStatements } from './schema.ts';
export class SectionWidgetStorageUnavailable extends Error {
  readonly code = 'MIGRATION_REQUIRED';
}
function descriptorSql(value: string): string {
  let normalized = '', space = false;
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (/\s/.test(character)) { space = normalized.length > 0; index++; continue; }
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
      normalized += quote === '"' && /^"[\w]+"$/.test(token) ? token.slice(1, -1) : token;
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
      descriptorSql(stored.sql) !== descriptorSql(object.sql)) {
      throw new SectionWidgetStorageUnavailable(`Complete ${family} storage is not available`);
    }
  }
}
