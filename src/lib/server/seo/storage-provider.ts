// Source018 SEO table/index, hosted in the actual Native migration sequence.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright2026 Cloudflare Inc.; MIT. See notices/emdash-MIT.txt.
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { migrationObjects, type CmsMigrationProvider } from '../database/migration-provider.ts';

function statements(database: CmsDatabase): readonly CompiledQuery[] {
  const db = database.db;
  return [
    db.schema.createTable('_cms_seo')
      .addColumn('collection', 'text', column => column.notNull())
      .addColumn('content_id', 'text', column => column.notNull())
      .addColumn('seo_title', 'text')
      .addColumn('seo_description', 'text')
      .addColumn('seo_image', 'text')
      .addColumn('seo_canonical', 'text')
      .addColumn('seo_no_index', 'integer', column => column.notNull().defaultTo(0))
      .addColumn('created_at', 'text', column => column.notNull().defaultTo(sql`(datetime('now'))`))
      .addColumn('updated_at', 'text', column => column.notNull().defaultTo(sql`(datetime('now'))`))
      .addPrimaryKeyConstraint('_cms_seo_pk', ['collection', 'content_id'])
      .compile(),
    sql`CREATE INDEX idx_cms_seo_collection ON _cms_seo (collection)`.compile(db)
  ];
}

/** Existing provider3 owns has_seo; Source018's ALTER is already satisfied. */
export const seoStorageMigration: CmsMigrationProvider = {
  version: 17,
  name: 'seo-storage',
  async statements(database) { return statements(database); },
  async expectedObjects(database) { return migrationObjects(statements(database)); }
};
