// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// Source005 menus + menu shapes from Source036 + Source078 translation groups.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';

/**
 * Unregistered fresh-schema descriptor for Source005 + menu-only036 +078.
 * A caller must explicitly apply these statements in a named storage fixture.
 * Requests only inspect readiness and never apply them.
 */
export function menuSchemaStatements(database: CmsDatabase, defaultLocale = 'en'): CompiledQuery[] {
  const db = database.db;
  return [
    sql`CREATE TABLE _cms_menus (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, label TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      locale TEXT NOT NULL DEFAULT ${sql.lit(defaultLocale)}, translation_group TEXT,
      UNIQUE(name, locale)
    )`.compile(db),
    sql`CREATE TABLE _cms_menu_items (
      id TEXT PRIMARY KEY, menu_id TEXT NOT NULL, parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0, type TEXT NOT NULL,
      reference_collection TEXT, reference_id TEXT, custom_url TEXT, label TEXT NOT NULL,
      title_attr TEXT, target TEXT, css_classes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      locale TEXT NOT NULL DEFAULT ${sql.lit(defaultLocale)}, translation_group TEXT
    )`.compile(db),
    sql`CREATE INDEX idx_menu_items_menu ON _cms_menu_items(menu_id, sort_order)`.compile(db),
    sql`CREATE INDEX idx_menu_items_parent ON _cms_menu_items(parent_id)`.compile(db),
    sql`CREATE INDEX idx__cms_menus_locale ON _cms_menus(locale)`.compile(db),
    sql`CREATE INDEX idx__cms_menus_translation_group ON _cms_menus(translation_group)`.compile(db),
    sql`CREATE INDEX idx__cms_menu_items_locale ON _cms_menu_items(locale)`.compile(db),
    sql`CREATE INDEX idx__cms_menu_items_translation_group ON _cms_menu_items(translation_group)`.compile(db)
  ];
}
