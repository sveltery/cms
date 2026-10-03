import { sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { migrationObjects } from '../database/migration-provider.ts';
import { menuSchemaStatements } from './migrations.ts';
import { getI18nConfig } from './i18n-config.ts';

// Normalize identifier quotes and formatting only outside SQLite string
// literals. Doubled single quotes, quoted text and whitespace inside a literal
// are owned schema data and must retain their exact bytes.
function normalizeOwnedMenuSql(value: string): string {
  return value.split(/('(?:''|[^'])*')/g)
    .map((part, index) => index % 2 === 1 ? part : part.replace(/"([\w]+)"/g, '$1').replace(/\s+/g, ' '))
    .join('').trim();
}

/** Readonly request census. This function neither migrates nor retains storage. */
export async function menuStorageReady(database: CmsDatabase, defaultLocale = getI18nConfig()?.defaultLocale ?? 'en'): Promise<boolean> {
  const expected = migrationObjects(menuSchemaStatements(database, defaultLocale));
  try {
    const { rows } = await sql<{name: string; type: string; sql: string | null}>`
      SELECT name, type, sql FROM sqlite_master
      WHERE name IN (${sql.join(expected.map(object => object.name))})
        OR tbl_name IN ('_cms_menus', '_cms_menu_items')`.execute(database.db);
    const owned = rows.filter(row => row.sql !== null);
    if (owned.length !== expected.length) return false;
    return expected.every(object => owned.some(row => row.name === object.name && row.type === object.type
      && typeof row.sql === 'string' && normalizeOwnedMenuSql(row.sql) === normalizeOwnedMenuSql(object.sql)));
  } catch { return false; }
}
