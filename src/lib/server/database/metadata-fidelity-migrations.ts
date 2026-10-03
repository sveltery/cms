// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 1.1.0 Source003 field cascade and Source012 nullable search configuration.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Frozen providers 1–5 remain unchanged.
import { sql, type CompiledQuery } from 'kysely';
import { CmsError, type CmsDatabase } from './contract.ts';
import type { CmsMigrationProvider } from './migration-provider.ts';
import { schemaMigration } from './schema-migrations.ts';
import { optionsMigration } from './options-migrations.ts';

const columns = ['id','collection_id','slug','label','type','column_type','required','unique',
  'default_value','validation','sort_order','created_at','widget','options','searchable','indexed','translatable'];
interface RebuildObject { name: string; type: string; tbl_name: string; sql: string | null }

function companionQuery(excludedTriggers: readonly string[]) {
  return sql<RebuildObject>`SELECT name,type,tbl_name,sql FROM sqlite_master
    WHERE sql IS NOT NULL AND (
      type='view' OR (type='trigger' AND name NOT IN (${sql.join(excludedTriggers)}))
      OR (type='index' AND tbl_name='_cms_fields' AND name<>'idx_cms_fields_collection')
      OR (type='table' AND name<>'_cms_fields' AND instr(lower(sql),'_cms_fields')>0)
    ) ORDER BY rowid`;
}
function snapshotGuard(database: CmsDatabase, excludedTriggers: readonly string[], objects: readonly RebuildObject[]): CompiledQuery {
  return sql`SELECT json_extract('[]', CASE WHEN
    (SELECT json_group_array(json_object('name',name,'type',type,'tbl_name',tbl_name,'sql',sql))
      FROM (${companionQuery(excludedTriggers)})) = ${JSON.stringify(objects.map(({name,type,tbl_name,sql}) => ({name,type,tbl_name,sql})))}
    THEN '$' ELSE 'sveltery-cms-metadata-rebuild-prerequisite-changed' END)`.compile(database.db);
}

export const metadataFidelityMigration: CmsMigrationProvider = {
  version: 8, name: 'metadata-storage-fidelity',
  async expectedObjects(database) {
    return (await schemaMigration.expectedObjects(database)).map(object => {
      if (object.name === '_cms_fields') return { ...object,
        sql: object.sql.replace('"_cms_collections"(id)', '"_cms_collections"(id) ON DELETE CASCADE') };
      if (object.name === '_cms_collections') return { ...object, sql: object.sql.replace(/\)\s*$/, ', search_config TEXT)') };
      return object;
    });
  },
  async statements(database) {
    const excluded = (await optionsMigration.expectedTriggers(database)).map(object => object.name);
    const objects = (await companionQuery(excluded).execute(database.db)).rows;
    // Dropping a referenced parent can execute ON DELETE actions despite
    // deferred FK checking. Refuse this external layout before any startup batch.
    for (const object of objects.filter(object => object.type === 'table')) {
      const references = (await sql<{table: string}>`PRAGMA foreign_key_list(${sql.id(object.name)})`.execute(database.db)).rows;
      if (references.some(row => row.table.toLowerCase() === '_cms_fields')) throw new CmsError('MIGRATION_REQUIRED');
    }
    const descriptors = await this.expectedObjects(database);
    const fields = descriptors.find(object => object.name === '_cms_fields')!;
    const db = database.db;
    const fieldColumns = columns.map(column => sql.id(column));
    // Capture every view/trigger, not only direct text matches: SQLite reparses
    // indirect dependencies during ALTER RENAME. Recreate exact SQL in original
    // creation order after the metadata copy, without invoking operator triggers.
    const dependents = objects.filter(object => object.type === 'view' || object.type === 'trigger');
    const customIndexes = objects.filter(object => object.type === 'index');
    return [snapshotGuard(database, excluded, objects),
      ...dependents.map(object => sql`${sql.raw(`DROP ${object.type.toUpperCase()} `)}${sql.id(object.name)}`.compile(db)),
      sql.raw(fields.sql.replace('"_cms_fields"', '"_cms_fields_v8"')).compile(db),
      sql`INSERT INTO _cms_fields_v8 (${sql.join(fieldColumns)}) SELECT ${sql.join(fieldColumns)} FROM _cms_fields`.compile(db),
      sql`DROP TABLE _cms_fields`.compile(db),
      sql`ALTER TABLE _cms_fields_v8 RENAME TO _cms_fields`.compile(db),
      sql`CREATE INDEX idx_cms_fields_collection ON _cms_fields(collection_id, sort_order)`.compile(db),
      sql`ALTER TABLE _cms_collections ADD COLUMN search_config TEXT`.compile(db),
      ...customIndexes.map(object => sql.raw(object.sql!).compile(db)),
      ...dependents.map(object => sql.raw(object.sql!).compile(db))
    ];
  }
};
