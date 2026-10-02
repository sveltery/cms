// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Adapted EmDash 1.1.0 migrations 001/014/059 and schema/registry.ts:1870.
// Immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Provider artifact supplied by lifecycle service checkpoint 72fe8ff; host
// preflight, snapshot guards and canonical version registration are local.
import { sql, type CompiledQuery } from 'kysely';
import { ulid } from 'ulidx';
import { CmsError, type CmsDatabase } from './contract.ts';
import { migrationObjects, normalizeMigrationSql, type CmsMigrationProvider } from './migration-provider.ts';
import { isStoragelessFieldRow } from '../schema/types.ts';

function staticStatements(database: CmsDatabase): CompiledQuery[] {
  return [
    sql`CREATE TABLE _cms_revisions (id TEXT PRIMARY KEY, collection TEXT NOT NULL,
      entry_id TEXT NOT NULL, data TEXT NOT NULL, author_id TEXT,
      created_at TEXT DEFAULT (datetime('now')))`.compile(database.db),
    sql`CREATE INDEX idx_cms_revisions_entry ON _cms_revisions (collection, entry_id)`.compile(database.db),
    sql`CREATE TABLE _cms_revision_prune_queue (collection TEXT NOT NULL, entry_id TEXT NOT NULL,
      revision_id TEXT NOT NULL, PRIMARY KEY(collection, entry_id))`.compile(database.db),
    sql`CREATE INDEX idx_cms_revision_prune_queue_revision_id ON _cms_revision_prune_queue (revision_id)`.compile(database.db)
  ];
}

interface SchemaObject { name:string; type:string; tbl_name:string; sql:string|null }
interface RegisteredCollection { id:string; slug:string; version:number }
interface RegisteredField { collection_id:string; slug:string; type:string; column_type:string; validation:string|null }
const contentObjectsSql = sql`SELECT name,type,tbl_name,sql FROM sqlite_master
  WHERE tbl_name GLOB 'ec_*' OR name GLOB '_cms_lifecycle_*'
    OR (type='table' AND instr(upper(sql),'REFERENCES')>0 AND instr(lower(sql),'ec_')>0) ORDER BY name`;
const collectionsSql = sql`SELECT id,slug,version FROM _cms_collections ORDER BY slug`;
const fieldsSql = sql`SELECT collection_id,slug,type,column_type,validation FROM _cms_fields ORDER BY collection_id,slug`;
function snapshotQuery() {
  return sql<{objects:string;collections:string;fields:string}>`SELECT
    (SELECT json_group_array(json_object('name',name,'type',type,'tbl_name',tbl_name,'sql',sql)) FROM (${contentObjectsSql})) AS objects,
    (SELECT json_group_array(json_object('id',id,'slug',slug,'version',version)) FROM (${collectionsSql})) AS collections,
    (SELECT json_group_array(json_object('collection_id',collection_id,'slug',slug,'type',type,'column_type',column_type,'validation',validation)) FROM (${fieldsSql})) AS fields`;
}

// The immutable local v1-v4 registry system definitions are known explicitly.
// Field columns retain their historical physical default/unique definitions.
const systemDefinitions = [
  'id TEXT PRIMARY KEY NOT NULL', 'slug TEXT', "status TEXT NOT NULL DEFAULT 'draft'",
  'author_id TEXT', "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
  "updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
  'published_at TEXT', 'scheduled_at TEXT', 'deleted_at TEXT',
  'version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0)', 'live_revision_id TEXT',
  'draft_revision_id TEXT', "locale TEXT NOT NULL DEFAULT 'en'", 'translation_group TEXT'
];
const system = new Map(systemDefinitions.map(definition=>[definition.split(' ')[0],normalizeMigrationSql(definition)]));
const identifier = /^[a-z][a-z0-9_]{0,62}$/;

/** Split SQLite's stored CREATE TABLE without splitting strings or defaults. */
function definitions(statement:string, name:string): string[] {
  const match = /^CREATE TABLE\s+(?:"([a-z0-9_]+)"|([a-z0-9_]+))\s*\(([\s\S]*)\)$/i.exec(statement.trim());
  if (!match || (match[1] ?? match[2]) !== name) throw new CmsError('MIGRATION_REQUIRED');
  const source=match[3]; const values:string[]=[];
  let start=0, depth=0, quote='';
  for (let index=0;index<source.length;index++) {
    const char=source[index];
    if (quote) {
      if (char===quote) { if (source[index+1]===quote) index++; else quote=''; }
    } else if (char==='\'' || char==='"') quote=char;
    else if (char==='(') depth++;
    else if (char===')') { if (--depth<0) throw new CmsError('MIGRATION_REQUIRED'); }
    else if (char===',' && depth===0) { values.push(source.slice(start,index).trim()); start=index+1; }
  }
  if (quote || depth) throw new CmsError('MIGRATION_REQUIRED');
  values.push(source.slice(start).trim());
  return values;
}

function validateTable(object:SchemaObject, fields:RegisteredField[], installed:boolean): string {
  if (object.type!=='table' || !object.sql) throw new CmsError('MIGRATION_REQUIRED');
  const columns=new Map<string,string>(); let unique=false;
  for (const definition of definitions(object.sql,object.name)) {
    const normalized=normalizeMigrationSql(definition);
    if (normalized==='UNIQUE(slug, locale)') { if (unique) throw new CmsError('MIGRATION_REQUIRED'); unique=true; continue; }
    const column=/^(?:"([a-z0-9_]+)"|([a-z0-9_]+))\s+/i.exec(definition);
    const name=column?.[1] ?? column?.[2];
    if (!name || columns.has(name)) throw new CmsError('MIGRATION_REQUIRED');
    columns.set(name,normalized);
  }
  if (!unique) throw new CmsError('MIGRATION_REQUIRED');
  for (const [name,wanted] of system) {
    const actual=columns.get(name);
    const legacy=name==='status' && !installed && actual===wanted+" CHECK(status = 'draft')";
    if (actual!==wanted && !legacy) throw new CmsError('MIGRATION_REQUIRED');
    columns.delete(name);
  }
  const byline=columns.get('primary_byline_id');
  if ((installed && byline!=='primary_byline_id TEXT') || (byline!==undefined && byline!=='primary_byline_id TEXT')) throw new CmsError('MIGRATION_REQUIRED');
  columns.delete('primary_byline_id');
  const registered=new Set<string>();
  for (const field of fields) {
    if (!identifier.test(field.slug) || system.has(field.slug) || field.slug==='primary_byline_id' || registered.has(field.slug)) throw new CmsError('MIGRATION_REQUIRED');
    registered.add(field.slug);
    const actual=columns.get(field.slug);
    if (isStoragelessFieldRow(field)) { if (actual!==undefined) throw new CmsError('MIGRATION_REQUIRED'); continue; }
    if (!['TEXT','REAL','INTEGER','JSON'].includes(field.column_type) || !actual || !actual.startsWith(field.slug+' '+field.column_type) || !new RegExp('^'+field.slug+' '+field.column_type+'(?:$| )').test(actual)) throw new CmsError('MIGRATION_REQUIRED');
    // Preserve supported historical NULL/default/unique column clauses; reject
    // an unrecognized generated/FK/constraint layout rather than repairing it.
    const clauses=actual.slice(field.slug.length+field.column_type.length+1);
    if (!/^(?: NOT NULL)?(?: DEFAULT (?:'(?:[^']|'')*'|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|NULL|TRUE|FALSE))?(?: UNIQUE)?$/i.test(clauses)) throw new CmsError('MIGRATION_REQUIRED');
    columns.delete(field.slug);
  }
  if (columns.size) throw new CmsError('MIGRATION_REQUIRED');
  let upgraded=object.sql.replace(/\s+CHECK\s*\(status\s*=\s*'draft'\)/i,'');
  if (byline===undefined) upgraded=upgraded.replace(/\bauthor_id TEXT\b/i,'author_id TEXT, primary_byline_id TEXT');
  return upgraded;
}

async function contentSnapshot(database:CmsDatabase, installed:boolean) {
  const exists=(await sql`SELECT name FROM sqlite_master WHERE name='_cms_collections' AND type='table'`.execute(database.db)).rows.length;
  if (!exists && installed) throw new CmsError('MIGRATION_REQUIRED');
  // Fresh preparation precedes foundation DDL, but existing ec objects still
  // require validation. Keep the empty metadata snapshot for the batch guard:
  // foundation creates these tables before provider 5 runs in that transaction.
  const snapshot=(await (exists ? snapshotQuery() :
    sql<{objects:string;collections:string;fields:string}>`SELECT
      (SELECT json_group_array(json_object('name',name,'type',type,'tbl_name',tbl_name,'sql',sql)) FROM (${contentObjectsSql})) AS objects,
      '[]' AS collections, '[]' AS fields`).execute(database.db)).rows[0];
  const objects=JSON.parse(snapshot.objects) as SchemaObject[];
  const collections=JSON.parse(snapshot.collections) as RegisteredCollection[];
  const fields=JSON.parse(snapshot.fields) as RegisteredField[];
  if (collections.length>100 || objects.some(row=>row.name.startsWith('_cms_lifecycle_'))) throw new CmsError('MIGRATION_REQUIRED');
  const tables=[];
  const names=new Set(collections.map(row=>'ec_'+row.slug));
  if (objects.some(row=>(row.type==='table'||row.type==='view')&&!names.has(row.name))) throw new CmsError('MIGRATION_REQUIRED');
  // Operator tables referencing ec parents are included in the snapshot and
  // rejected above: DROP could activate cascading FK actions. This avoids
  // unsupported D1 pragma introspection and guards their concurrent creation.
  for (const collection of collections) {
    if (!identifier.test(collection.slug)) throw new CmsError('MIGRATION_REQUIRED');
    const name='ec_'+collection.slug; const object=objects.find(row=>row.name===name);
    if (!object) throw new CmsError('MIGRATION_REQUIRED');
    const registeredFields=fields.filter(row=>row.collection_id===collection.id);
    if (registeredFields.length>32) throw new CmsError('MIGRATION_REQUIRED');
    tables.push({object,target:validateTable(object,registeredFields,installed)});
  }
  return {snapshot,objects,tables};
}

export const lifecycleMigration:CmsMigrationProvider = {
  version:5, name:'content-lifecycle',
  async statements(database) {
    const content=await contentSnapshot(database,false);
    const statements=staticStatements(database);
    const token=ulid();
    // Execute before lifecycle DDL in the same batch as foundation. A writer
    // after fresh or legacy preflight cannot install unvalidated content objects
    // or have its new fields/indexes overwritten.
    statements.unshift(sql`INSERT INTO _cms_guards(token,pass) SELECT ${token}, CASE WHEN EXISTS
      (SELECT 1 FROM (${snapshotQuery()}) WHERE objects=${content.snapshot.objects}
        AND collections=${content.snapshot.collections} AND fields=${content.snapshot.fields}) THEN 1 ELSE 0 END`.compile(database.db));
    for (const {object,target} of content.tables) {
      if (target===object.sql) continue;
      const temporary='_cms_lifecycle_'+object.name+'_v5';
      const create=target.replace(/^CREATE TABLE\s+(?:"[^"]+"|\w+)/i,'CREATE TABLE "'+temporary+'"');
      const columns=definitions(object.sql!,object.name).flatMap(definition=>{
        const match=/^(?:"([a-z0-9_]+)"|([a-z0-9_]+))\s+/i.exec(definition);
        return match ? [sql.ref(match[1] ?? match[2])] : [];
      });
      const retained=content.objects.filter(row=>row.tbl_name===object.name && ['index','trigger'].includes(row.type) && row.sql!==null);
      statements.push(sql.raw(create).compile(database.db),
        sql`INSERT INTO ${sql.ref(temporary)} (${sql.join(columns)}) SELECT ${sql.join(columns)} FROM ${sql.ref(object.name)}`.compile(database.db),
        sql`DROP TABLE ${sql.ref(object.name)}`.compile(database.db),
        sql`ALTER TABLE ${sql.ref(temporary)} RENAME TO ${sql.ref(object.name)}`.compile(database.db),
        ...retained.map(row=>sql.raw(row.sql!).compile(database.db)));
    }
    statements.push(sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db));
    return statements;
  },
  async expectedObjects(database,installedVersion=0) {
    const objects=migrationObjects(staticStatements(database));
    // Existing v1-v4 ec tables are not partially installed future objects.
    if (installedVersion>=5) {
      const content=await contentSnapshot(database,true);
      for (const {object,target} of content.tables) objects.push({name:object.name,type:'table',sql:target});
    }
    return objects;
  }
};
