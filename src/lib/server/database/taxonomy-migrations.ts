// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 1.1.0 Source001/006/015/036/045/047/048/049/051/056/068/082/085.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; complete chronology retained in the source ledger.
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from './contract.ts';
import { migrationObjects, type CmsMigrationProvider } from './migration-provider.ts';

function taxonomyStatements(database: CmsDatabase): CompiledQuery[] {
  const db = database.db;
  return [
    sql`CREATE TABLE _cms_taxonomies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, label TEXT NOT NULL,
      parent_id TEXT, data TEXT, locale TEXT NOT NULL DEFAULT 'en', translation_group TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(name, slug, locale),
      FOREIGN KEY(parent_id) REFERENCES _cms_taxonomies(id) ON DELETE SET NULL
    )`.compile(db),
    sql`CREATE INDEX idx_cms_taxonomies_parent ON _cms_taxonomies(parent_id)`.compile(db),
    sql`CREATE INDEX idx_cms_taxonomies_locale ON _cms_taxonomies(locale)`.compile(db),
    sql`CREATE INDEX idx_cms_taxonomies_translation_group ON _cms_taxonomies(translation_group)`.compile(db),
    sql`CREATE INDEX idx_cms_taxonomies_name_locale ON _cms_taxonomies(name, locale)`.compile(db),
    sql`CREATE UNIQUE INDEX idx_cms_taxonomies_translation_group_locale_unique
      ON _cms_taxonomies(translation_group, locale) WHERE translation_group IS NOT NULL`.compile(db),
    sql`CREATE TABLE _cms_content_taxonomies (
      collection TEXT NOT NULL, entry_id TEXT NOT NULL, taxonomy_id TEXT NOT NULL,
      status TEXT, scheduled_at TEXT, deleted_at TEXT, locale TEXT, published_at TEXT, created_at TEXT,
      PRIMARY KEY(collection, entry_id, taxonomy_id)
    )`.compile(db),
    sql`CREATE INDEX idx_cms_content_taxonomies_term ON _cms_content_taxonomies(taxonomy_id)`.compile(db),
    sql`CREATE INDEX idx_cms_content_taxonomies_group_lookup ON _cms_content_taxonomies(taxonomy_id, collection, entry_id)`.compile(db),
    sql`CREATE TABLE _cms_taxonomy_defs (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, label TEXT NOT NULL, label_singular TEXT,
      hierarchical INTEGER DEFAULT 0, collections TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      locale TEXT NOT NULL DEFAULT 'en', translation_group TEXT, UNIQUE(name, locale)
    )`.compile(db),
    sql`CREATE INDEX idx_cms_taxonomy_defs_locale ON _cms_taxonomy_defs(locale)`.compile(db),
    sql`CREATE INDEX idx_cms_taxonomy_defs_translation_group ON _cms_taxonomy_defs(translation_group)`.compile(db),
    sql`CREATE TABLE _cms_taxonomy_def_groups (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, hierarchical INTEGER NOT NULL DEFAULT 0,
      collections TEXT NOT NULL DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`.compile(db)
  ];
}

export const taxonomyMigration: CmsMigrationProvider = {
  version: 7, name: 'taxonomy-storage',
  async expectedObjects(database) { return migrationObjects(taxonomyStatements(database)); },
  async statements(database) {
    const db = database.db;
    return [...taxonomyStatements(database),
      sql`INSERT INTO _cms_taxonomy_defs
        (id,name,label,label_singular,hierarchical,collections,locale,translation_group)
        VALUES ('taxdef_category','category','Categories','Category',1,'["posts"]','en','taxdef_category'),
          ('taxdef_tag','tag','Tags','Tag',0,'["posts"]','en','taxdef_tag')`.compile(db),
      sql`INSERT INTO _cms_taxonomy_def_groups (id,name,hierarchical,collections)
        VALUES ('taxdef_category','category',1,'["posts"]'), ('taxdef_tag','tag',0,'["posts"]')`.compile(db)
    ];
  }
};
