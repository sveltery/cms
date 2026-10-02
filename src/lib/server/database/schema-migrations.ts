import { sql } from 'kysely';
import type { CmsDatabase } from './contract.ts';
import { migrationObjects, type CmsMigrationProvider } from './migration-provider.ts';

function schemaStatements(database: CmsDatabase, suffix = '') {
  const db = database.db;
  return [sql`CREATE TABLE ${sql.ref('_cms_collections' + suffix)} (
    id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
    label_singular TEXT, description TEXT, supports TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
    version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    icon TEXT, admin_config TEXT, has_seo INTEGER NOT NULL DEFAULT 0 CHECK(has_seo IN (0,1)),
    title_field TEXT, date_field TEXT, url_pattern TEXT,
    routable INTEGER NOT NULL DEFAULT 1 CHECK(routable IN (0,1)),
    hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), sort_order INTEGER, nav_group TEXT,
    comments_enabled INTEGER NOT NULL DEFAULT 0 CHECK(comments_enabled IN (0,1)),
    comments_moderation TEXT NOT NULL DEFAULT 'first_time' CHECK(comments_moderation IN ('all','first_time','none')),
    comments_closed_after_days INTEGER NOT NULL DEFAULT 90,
    comments_auto_approve_users INTEGER NOT NULL DEFAULT 0 CHECK(comments_auto_approve_users IN (0,1)),
    edit_locking INTEGER NOT NULL DEFAULT 1 CHECK(edit_locking IN (0,1))
  )`.compile(db),
  sql`CREATE TABLE ${sql.ref('_cms_fields' + suffix)} (
    id TEXT PRIMARY KEY NOT NULL, collection_id TEXT NOT NULL REFERENCES ${sql.ref('_cms_collections' + suffix)}(id),
    slug TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL,
    column_type TEXT NOT NULL CHECK(column_type IN ('TEXT','REAL','INTEGER','JSON')),
    required INTEGER NOT NULL CHECK(required IN (0,1)), "unique" INTEGER NOT NULL CHECK("unique" IN (0,1)),
    default_value TEXT, validation TEXT, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL,
    widget TEXT, options TEXT, searchable INTEGER NOT NULL DEFAULT 0 CHECK(searchable IN (0,1)),
    indexed INTEGER NOT NULL DEFAULT 0 CHECK(indexed IN (0,1)),
    translatable INTEGER NOT NULL DEFAULT 1 CHECK(translatable IN (0,1)), UNIQUE(collection_id, slug)
  )`.compile(db)];
}
export const schemaMigration: CmsMigrationProvider = {
  version: 3, name: 'complete-schema-metadata',
  async expectedObjects(database) {
    return migrationObjects([...schemaStatements(database),
      sql`CREATE INDEX idx_cms_fields_collection ON _cms_fields(collection_id, sort_order)`.compile(database.db)]);
  },
  async statements(database) {
    const db = database.db;
    return [...schemaStatements(database, '_v3'),
      sql`INSERT INTO _cms_collections_v3 (id,slug,label,label_singular,description,supports,source,version,created_at,updated_at)
        SELECT id,slug,label,label_singular,description,supports,source,version,created_at,updated_at FROM _cms_collections`.compile(db),
      sql`INSERT INTO _cms_fields_v3 (id,collection_id,slug,label,type,column_type,required,"unique",default_value,validation,sort_order,created_at)
        SELECT id,collection_id,slug,label,type,column_type,required,"unique",default_value,validation,sort_order,created_at FROM _cms_fields`.compile(db),
      sql`DROP TABLE _cms_fields`.compile(db), sql`DROP TABLE _cms_collections`.compile(db),
      sql`ALTER TABLE _cms_collections_v3 RENAME TO _cms_collections`.compile(db),
      sql`ALTER TABLE _cms_fields_v3 RENAME TO _cms_fields`.compile(db),
      sql`CREATE INDEX idx_cms_fields_collection ON _cms_fields(collection_id, sort_order)`.compile(db)
    ];
  }
};
