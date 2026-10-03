import { sql, type Kysely } from 'kysely';
import { migrationObjects, normalizeMigrationSql } from '../database/migration-provider.ts';
import { sectionSchemaStatements, widgetSchemaStatements } from './schema.ts';
export class SectionWidgetStorageUnavailable extends Error {
  readonly code = 'MIGRATION_REQUIRED';
}
function descriptorSql(value: string): string {
  // SQLite stores CREATE keywords uppercase; keep every literal and remaining DDL token intact.
  return normalizeMigrationSql(value).replace(/^create (?:unique )?(?:table|index)/i, token => token.toUpperCase());
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
