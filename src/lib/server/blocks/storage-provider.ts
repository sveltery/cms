import { CompiledQuery, sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { CmsError } from '../database/contract.ts';
import { RawBindingD1Adapter } from '../database/d1.ts';
import type { MigrationObject } from '../database/migration-provider.ts';
import { metadataFidelityMigration } from '../database/metadata-fidelity-migrations.ts';
import { optionsMigration } from '../database/options-migrations.ts';
import { mediaAttributionMigration, commentsMigration, redirectsMigration, type UnregisteredFeatureMigration } from '../database/canonical-features/providers.ts';
import blockSchema from './block-storage-schema.json' with { type: 'json' };

interface StoredObject { creation_order: number; name: string; type: string; tbl_name: string; sql: string | null }
const columns = ['id','collection_id','slug','label','type','column_type','required','unique',
  'default_value','validation','sort_order','created_at','widget','options','searchable','indexed','translatable'];
const collectionColumns = ['id','slug','label','label_singular','description','supports','source','version',
  'created_at','updated_at','icon','admin_config','has_seo','title_field','date_field','url_pattern',
  'routable','hidden','sort_order','nav_group','comments_enabled','comments_moderation',
  'comments_closed_after_days','comments_auto_approve_users','edit_locking','search_config'];
const catalogue = 'SELECT rowid AS creation_order,name,type,tbl_name,sql FROM sqlite_master ORDER BY name,type';
const snapshotSql = 'SELECT json_group_array(json_object(\'creation_order\',creation_order,\'name\',name,\'type\',type,\'tbl_name\',tbl_name,\'sql\',sql)) FROM (' + catalogue + ')';
const changed = 'sveltery-cms-migration-prerequisite-changed';
const quote = (database: CmsDatabase, name: string) => sql.id(name).compile(database.db).sql;

async function metadataObjects(database: CmsDatabase): Promise<MigrationObject[]> {
  return (await metadataFidelityMigration.expectedObjects(database)).map(object => {
    if (object.name === '_cms_collections') return { ...object, sql: object.sql
      .replace('created_at TEXT NOT NULL', "created_at TEXT NOT NULL DEFAULT (datetime('now'))")
      .replace('updated_at TEXT NOT NULL', "updated_at TEXT NOT NULL DEFAULT (datetime('now'))")
      .replace('comments_auto_approve_users INTEGER NOT NULL DEFAULT 0', 'comments_auto_approve_users INTEGER NOT NULL DEFAULT 1') };
    if (object.name === '_cms_fields') return { ...object, sql: object.sql
      .replace('required INTEGER NOT NULL CHECK', 'required INTEGER NOT NULL DEFAULT 0 CHECK')
      .replace('"unique" INTEGER NOT NULL CHECK', '"unique" INTEGER NOT NULL DEFAULT 0 CHECK')
      .replace('sort_order INTEGER NOT NULL', 'sort_order INTEGER NOT NULL DEFAULT 0')
      .replace('created_at TEXT NOT NULL', "created_at TEXT NOT NULL DEFAULT (datetime('now'))") };
    return object;
  });
}

async function knownTriggers(database: CmsDatabase): Promise<StoredObject[]> {
  const triggers = [...await optionsMigration.expectedTriggers!(database),
    ...await mediaAttributionMigration.expectedTriggers(database), ...await commentsMigration.expectedTriggers(database),
    ...await redirectsMigration.expectedTriggers(database)];
  return triggers.map((object,index) => ({...object, creation_order: index, tbl_name: ''}));
}
async function plan(database: CmsDatabase) {
  const rows = (await database.db.executeQuery<StoredObject>(CompiledQuery.raw(catalogue))).rows;
  // Rebuilding either metadata parent may run an external FK's ON DELETE action.
  // Refuse every such parent reference before any startup write.
  const rawD1 = database.db.getExecutor().adapter instanceof RawBindingD1Adapter;
  for (const object of rows.filter(object => object.type === 'table' && !object.name.startsWith('sqlite_') &&
      !(rawD1 && object.name.toLowerCase().startsWith('_cf_')))) {
    const references = (await database.db.executeQuery<{table: string}>(CompiledQuery.raw(
      'PRAGMA foreign_key_list(' + quote(database, object.name) + ')'))).rows;
    if (references.some(reference => ['_cms_fields','_cms_collections'].includes(reference.table.toLowerCase()) &&
        !(object.name === '_cms_fields' && reference.table === '_cms_collections'))) throw new CmsError('MIGRATION_REQUIRED');
  }
  const snapshots = JSON.stringify(rows.map(({creation_order,name,type,tbl_name,sql}) => ({creation_order,name,type,tbl_name,sql})));
  const guard = CompiledQuery.raw("SELECT json_extract('[]', CASE WHEN (" + snapshotSql + ") = ? THEN '$' ELSE ? END)", [snapshots, changed]);
  const metadata = await metadataObjects(database);
  const collections = metadata.find(object => object.name === '_cms_collections')!;
  const fields = metadata.find(object => object.name === '_cms_fields')!;
  const currentDependents = rows.filter(object => (object.type === 'view' || object.type === 'trigger') && object.sql !== null)
    .sort((left,right) => left.creation_order-right.creation_order);
  const future = await knownTriggers(database);
  // Source static triggers may be installed by providers 6, 9, 13 or 14 later in
  // this same atomic batch. Drop them before metadata rename, then restore them.
  const currentKeys = new Set(currentDependents.map(object => object.type + ':' + object.name));
  // Existing objects precede providers not installed in this historical store.
  // Append absent static triggers in their original provider6/9/13/14 order.
  const dependents = new Map([...currentDependents,
    ...future.filter(object => !currentKeys.has(object.type + ':' + object.name))]
    .map(object => [object.type + ':' + object.name, object]));
  const indexes = rows.filter(object => object.type === 'index' && object.sql !== null &&
    ['_cms_fields','_cms_collections'].includes(object.tbl_name) && object.name !== 'idx_cms_fields_collection');
  const statements = [...dependents.values()].map(object => CompiledQuery.raw(
    'DROP ' + object.type.toUpperCase() + ' IF EXISTS ' + quote(database, object.name)));
  statements.push(
    CompiledQuery.raw(collections.sql.replace('"_cms_collections"', '"_cms_collections_v15"')),
    CompiledQuery.raw(fields.sql.replace('"_cms_fields"', '"_cms_fields_v15"').replace('"_cms_collections"', '"_cms_collections_v15"')),
    CompiledQuery.raw('INSERT INTO "_cms_collections_v15" (' + collectionColumns.map(column => quote(database,column)).join(',') +
      ') SELECT ' + collectionColumns.map(column => quote(database,column)).join(',') + ' FROM "_cms_collections"'),
    CompiledQuery.raw('INSERT INTO "_cms_fields_v15" (' + columns.map(column => quote(database,column)).join(',') +
      ') SELECT ' + columns.map(column => quote(database,column)).join(',') + ' FROM "_cms_fields"'),
    CompiledQuery.raw('DROP TABLE "_cms_fields"'), CompiledQuery.raw('DROP TABLE "_cms_collections"'),
    CompiledQuery.raw('ALTER TABLE "_cms_collections_v15" RENAME TO "_cms_collections"'),
    CompiledQuery.raw('ALTER TABLE "_cms_fields_v15" RENAME TO "_cms_fields"'),
    CompiledQuery.raw(metadata.find(object => object.name === 'idx_cms_fields_collection')!.sql),
    ...indexes.map(object => CompiledQuery.raw(object.sql!)),
    ...[...dependents.values()].map(object => CompiledQuery.raw(object.sql!)),
    ...blockSchema.objects.map(object => CompiledQuery.raw(object.sql)));
  return { guards: [guard], statements };
}

/** Append only after actual public canonical providers 1–14; never mutate them. */
export const blockStorageMigration: UnregisteredFeatureMigration = {
  version: 15, name: 'block-types-and-source-creation-defaults',
  async prepare(database) { return plan(database); },
  async statements(database) { const prepared = await plan(database); return [...prepared.guards,...prepared.statements]; },
  async expectedObjects(database) {
    return [...await metadataObjects(database), ...blockSchema.objects.map(object => ({...object,type:object.type as 'table'|'index'}))];
  },
  async expectedTriggers() { return []; }
};
