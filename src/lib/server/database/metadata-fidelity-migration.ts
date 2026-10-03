// Fidelity repair for EmDash 1.1.0 migrations 003_schema_registry and 012_search.
// Source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc.
// MIT: notices/emdash-MIT.txt. Historical native migrations remain unchanged.
import { sql } from 'kysely';
import { CmsError, type CmsDatabase } from './contract.ts';
import type { CmsMigrationProvider } from './migration-provider.ts';
import { schemaMigration } from './schema-migrations.ts';

const fieldColumns = ['id','collection_id','slug','label','type','column_type','required','unique',
  'default_value','validation','sort_order','created_at','widget','options','searchable','indexed','translatable'];

interface OperatorObject {name:string;type:string;tbl_name:string;sql:string|null}
// All views/triggers are temporarily removed because their dependency graphs
// may reference each other. Their exact SQL is restored after the metadata
// replacement. Canonical field indexes are recreated by the provider itself.
function operatorObjects(parents:readonly string[]) {
  return sql`SELECT name,type,tbl_name,sql FROM sqlite_master WHERE
    type IN ('view','trigger') OR (type='index' AND lower(tbl_name) IN (${sql.join(parents)})
      AND lower(name)<>'idx_cms_fields_collection') OR
    (type='table' AND lower(name) NOT IN (${sql.join(parents)}) AND
      (${sql.join(parents.map(parent=>sql`instr(lower(sql),${parent})>0`),sql` OR `)})
      AND instr(upper(sql),'REFERENCES')>0) ORDER BY name,type`;
}

async function prepareMetadata(database:CmsDatabase,installedVersion=8) {
  const historical=installedVersion===1||installedVersion===2;
  const parents=historical ? ['_cms_fields','_cms_collections'] : ['_cms_fields'];
  const catalogue=operatorObjects(parents);
  const objects=(await catalogue.execute(database.db)).rows as unknown as OperatorObject[];
  for(const object of objects.filter(object=>object.type==='table')) {
    const foreignKeys=(await sql<{table:string}>`PRAGMA foreign_key_list(${sql.id(object.name)})`.execute(database.db)).rows;
    // Dropping a referenced parent can silently cascade or null child rows.
    // Do not disable FK enforcement or claim an unsupported preservation path.
    if(foreignKeys.some(key=>parents.includes(key.table.toLowerCase()))) throw new CmsError('MIGRATION_REQUIRED');
  }
  const snapshot=JSON.stringify(objects);
  const guard=sql`SELECT json_extract('[]',CASE WHEN
    (SELECT json_group_array(json_object('name',name,'type',type,'tbl_name',tbl_name,'sql',sql))
      FROM (${catalogue}))=${snapshot}
    THEN '$' ELSE 'sveltery-cms-migration-prerequisite-changed' END)`.compile(database.db);
  const descriptors=await metadataFidelityMigration.expectedObjects(database);
  const fields=descriptors.find(object=>object.name==='_cms_fields')!;
  const columns=fieldColumns.map(column=>sql.id(column));
  const views=objects.filter(object=>object.type==='view'&&object.sql!==null);
  const triggers=objects.filter(object=>object.type==='trigger'&&object.sql!==null);
  const indexes=objects.filter(object=>object.type==='index'&&object.sql!==null);
  const removeCatalogue=[
    ...triggers.map(object=>sql`DROP TRIGGER IF EXISTS ${sql.id(object.name)}`.compile(database.db)),
    ...views.map(object=>sql`DROP VIEW ${sql.id(object.name)}`.compile(database.db))
  ];
  return {
    preconditions:[guard],
    prelude:historical ? removeCatalogue : [],
    statements:[
      // Lifecycle can restore its attached content triggers after the early
      // metadata preparation. Remove those again only for the actual rebuild.
      ...(historical ? triggers.map(object=>sql`DROP TRIGGER IF EXISTS ${sql.id(object.name)}`.compile(database.db)) : removeCatalogue),
      sql.raw(fields.sql.replace('"_cms_fields"','"_cms_fields_v8"')).compile(database.db),
      sql`INSERT INTO _cms_fields_v8 (${sql.join(columns)}) SELECT ${sql.join(columns)} FROM _cms_fields`.compile(database.db),
      sql`DROP TABLE _cms_fields`.compile(database.db),
      sql`ALTER TABLE _cms_fields_v8 RENAME TO _cms_fields`.compile(database.db),
      sql`CREATE INDEX idx_cms_fields_collection ON _cms_fields(collection_id, sort_order)`.compile(database.db),
      ...indexes.map(object=>sql.raw(object.sql!).compile(database.db)),
      sql`ALTER TABLE _cms_collections ADD COLUMN search_config TEXT`.compile(database.db),
      ...views.map(object=>sql.raw(object.sql!).compile(database.db)),
      ...triggers.map(object=>sql.raw(object.sql!).compile(database.db))
    ]
  };
}

export const metadataFidelityMigration: CmsMigrationProvider = {
  version:8, name:'metadata-storage-fidelity',
  async expectedObjects(database) {
    return (await schemaMigration.expectedObjects(database)).map(object => {
      if(object.name==='_cms_fields') return {...object,sql:object.sql.replace('"_cms_collections"(id)','"_cms_collections"(id) ON DELETE CASCADE')};
      if(object.name==='_cms_collections') return {...object,sql:object.sql.replace(/\)\s*$/,', search_config TEXT)')};
      return object;
    });
  },
  async prepare(database,installedVersion) {return prepareMetadata(database,installedVersion);},
  async statements(database) {
    const plan=await prepareMetadata(database);
    return [...plan.preconditions,...plan.statements];
  }
};
