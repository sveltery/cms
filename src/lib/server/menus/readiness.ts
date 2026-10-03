import { sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { migrationObjects } from '../database/migration-provider.ts';
import { menuSchemaStatements } from './migrations.ts';
import { getI18nConfig } from './i18n-config.ts';

// Only the descriptor's object/column identifiers may lose double quotes.
// Other quoted tokens can be SQLite literals (including timestamp defaults).
const ownedMenuIdentifiers = new Set([
  '_cms_menus', '_cms_menu_items', 'idx_menu_items_menu', 'idx_menu_items_parent',
  'idx__cms_menus_locale', 'idx__cms_menus_translation_group',
  'idx__cms_menu_items_locale', 'idx__cms_menu_items_translation_group',
  'id', 'name', 'label', 'created_at', 'updated_at', 'locale', 'translation_group',
  'menu_id', 'parent_id', 'sort_order', 'type', 'reference_collection', 'reference_id',
  'custom_url', 'title_attr', 'target', 'css_classes'
]);
function normalizeOwnedMenuSql(value: string): string {
  return value.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|[ \t\r\n\v\f]+/g, token => {
    if (/^[ \t\r\n\v\f]+$/.test(token)) return ' ';
    if (token.startsWith('"') && ownedMenuIdentifiers.has(token.slice(1, -1))) return token.slice(1, -1);
    return token;
  }).trim();
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
