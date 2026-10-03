import type {CmsDatabase} from '../database/contract.ts';
import {migrationObjects,type CmsMigrationProvider} from '../database/migration-provider.ts';
import {currentTimestamp} from '../database/lifecycle/upstream/database/dialect-helpers.ts';
import {blocksDatabase} from './host.ts';
export function blocksSchemaStatements(database:CmsDatabase) {
  const db=blocksDatabase(database);
  return [
    db.schema.createTable('_cms_block_types')
      .addColumn('id','text',column=>column.primaryKey())
      .addColumn('slug','text',column=>column.notNull().unique())
      .addColumn('label','text',column=>column.notNull())
      .addColumn('description','text').addColumn('icon','text').addColumn('category','text')
      .addColumn('current_version','integer',column=>column.notNull().defaultTo(1))
      .addColumn('source','text',column=>column.notNull().defaultTo('user'))
      .addColumn('created_at','text',column=>column.notNull().defaultTo(currentTimestamp(db)))
      .addColumn('updated_at','text',column=>column.notNull().defaultTo(currentTimestamp(db))).compile(),
    db.schema.createTable('_cms_block_type_versions')
      .addColumn('id','text',column=>column.primaryKey())
      .addColumn('block_type_id','text',column=>column.notNull())
      .addColumn('version','integer',column=>column.notNull())
      .addColumn('fields','text',column=>column.notNull())
      .addColumn('fingerprint','text',column=>column.notNull())
      .addColumn('created_at','text',column=>column.notNull().defaultTo(currentTimestamp(db)))
      .addColumn('updated_at','text',column=>column.notNull().defaultTo(currentTimestamp(db)))
      .addForeignKeyConstraint('block_type_versions_type_fk',['block_type_id'],'_cms_block_types',['id'],constraint=>constraint.onDelete('cascade')).compile(),
    db.schema.createIndex('idx_block_type_versions_type_version').on('_cms_block_type_versions').columns(['block_type_id','version']).unique().compile(),
    db.schema.createIndex('idx_block_type_versions_type').on('_cms_block_type_versions').column('block_type_id').compile()
  ].map(statement=>({...statement,sql:statement.sql.replace(/^create (?:unique )?(?:table|index)\b/,prefix=>prefix.toUpperCase())}));
}
export const blocksMigration:CmsMigrationProvider={version:10,name:'reusable-blocks',async statements(database){return blocksSchemaStatements(database);},async expectedObjects(database){return migrationObjects(blocksSchemaStatements(database));}};
