import { sql, type CompiledQuery, type Kysely } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { migrationObjects, type CmsMigrationProvider } from '../database/migration-provider.ts';
import type { Database } from './source/database/types.ts';
import { currentTimestamp } from './source/database/dialect-helpers.ts';

export const mediaDatabase = (database: CmsDatabase) => database.db as unknown as Kysely<Database>;

/** Real media DDL. Registration awaits the contiguous, approved providers 5–8. */
export function mediaSchemaStatements(database: CmsDatabase): CompiledQuery[] {
  const db = mediaDatabase(database);
  return [
    db.schema.createTable('media_folders')
      .addColumn('id','text',column=>column.primaryKey())
      .addColumn('name','text',column=>column.notNull())
      .addColumn('name_key','text',column=>column.notNull().unique()).compile(),
    db.schema.createTable('media')
      .addColumn('id','text',column=>column.primaryKey())
      .addColumn('filename','text',column=>column.notNull())
      .addColumn('mime_type','text',column=>column.notNull())
      .addColumn('size','integer').addColumn('width','integer').addColumn('height','integer')
      .addColumn('alt','text').addColumn('caption','text')
      .addColumn('storage_key','text',column=>column.notNull())
      .addColumn('content_hash','text')
      .addColumn('created_at','text',column=>column.defaultTo(currentTimestamp(db)))
      .addColumn('author_id','text')
      .addColumn('status','text',column=>column.notNull().defaultTo('ready'))
      .addColumn('blurhash','text').addColumn('dominant_color','text')
      .addColumn('folder_id','text',column=>column.references('media_folders.id').onDelete('set null'))
      .addColumn('focal_x','real').addColumn('focal_y','real').compile(),
    ...[['idx_media_content_hash','content_hash'],['idx_media_status','status'],['idx_media_storage_key','storage_key'],['idx_media_folder_id','folder_id']].map(([name,column])=>db.schema.createIndex(name).on('media').column(column).compile()),
    db.schema.createTable('_cms_media_upload_attempts')
      .addColumn('storage_key','text',column=>column.primaryKey())
      .addColumn('media_id','text',column=>column.notNull())
      .addColumn('status','text',column=>column.notNull().defaultTo('active'))
      .addColumn('created_at','text',column=>column.notNull().defaultTo(currentTimestamp(db)))
      .addColumn('updated_at','text',column=>column.notNull().defaultTo(currentTimestamp(db))).compile(),
    db.schema.createIndex('idx_media_upload_attempts_media_id').on('_cms_media_upload_attempts').column('media_id').compile(),
    db.schema.createIndex('idx_media_upload_attempts_status_created_at').on('_cms_media_upload_attempts').columns(['status','created_at']).compile()
  ];
}

export const mediaMigration: CmsMigrationProvider = {
  version:9, name:'media', async statements(database) { return mediaSchemaStatements(database); },
  async expectedObjects(database) { return migrationObjects(mediaSchemaStatements(database)); }
};
