// Native descriptors preserve Source007_widgets and final Source011→021 sections DDL.
// EmDash1.1.0 pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, MIT Cloudflare2026; notices/emdash-MIT.txt.
import { sql, type Kysely, type CompiledQuery } from 'kysely';
import { migrationObjects, type CmsMigrationProvider } from '../database/migration-provider.ts';

export function widgetSchemaStatements<DB>(db: Kysely<DB>): CompiledQuery[] {
  return [
    db.schema.createTable('_cms_widget_areas')
      .addColumn('id', 'text', c => c.primaryKey())
      .addColumn('name', 'text', c => c.notNull().unique())
      .addColumn('label', 'text', c => c.notNull())
      .addColumn('description', 'text')
      .addColumn('created_at', 'text', c => c.defaultTo(sql`CURRENT_TIMESTAMP`)).compile(),
    db.schema.createTable('_cms_widgets')
      .addColumn('id', 'text', c => c.primaryKey())
      .addColumn('area_id', 'text', c => c.notNull().references('_cms_widget_areas.id').onDelete('cascade'))
      .addColumn('sort_order', 'integer', c => c.notNull().defaultTo(0))
      .addColumn('type', 'text', c => c.notNull())
      .addColumn('title', 'text').addColumn('content', 'text')
      .addColumn('menu_name', 'text').addColumn('component_id', 'text').addColumn('component_props', 'text')
      .addColumn('created_at', 'text', c => c.defaultTo(sql`CURRENT_TIMESTAMP`)).compile(),
    db.schema.createIndex('idx_widgets_area').on('_cms_widgets').columns(['area_id', 'sort_order']).compile()
  ];
}
export function sectionSchemaStatements<DB>(db: Kysely<DB>): CompiledQuery[] {
  return [
    db.schema.createTable('_cms_sections')
      .addColumn('id', 'text', c => c.primaryKey())
      .addColumn('slug', 'text', c => c.notNull().unique())
      .addColumn('title', 'text', c => c.notNull())
      .addColumn('description', 'text')
      .addColumn('keywords', 'text').addColumn('content', 'text', c => c.notNull())
      .addColumn('preview_media_id', 'text')
      .addColumn('source', 'text', c => c.notNull().defaultTo('user'))
      .addColumn('theme_id', 'text')
      .addColumn('created_at', 'text', c => c.defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn('updated_at', 'text', c => c.defaultTo(sql`CURRENT_TIMESTAMP`)).compile(),
    db.schema.createIndex('idx_sections_source').on('_cms_sections').columns(['source']).compile()
  ];
}
/** Root owns the future contiguous canonical registration. This factory installs nothing. */
export function sectionsWidgetsMigration(version: number): CmsMigrationProvider {
  return { version, name: 'sections-and-site-widget-areas',
    async statements(database) { return [...widgetSchemaStatements(database.db), ...sectionSchemaStatements(database.db)]; },
    async expectedObjects(database) { return migrationObjects([...widgetSchemaStatements(database.db), ...sectionSchemaStatements(database.db)]); }
  };
}
