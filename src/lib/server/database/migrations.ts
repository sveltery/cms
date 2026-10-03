import {taxonomyMigration} from '../taxonomies/migration.ts';
import {metadataFidelityMigration} from './metadata-fidelity-migration.ts';
import { optionsMigration } from '../settings/migration.ts';
import { sql, type CompiledQuery } from 'kysely';
import { sqliteErrorMessage } from './errors.ts';
import { CmsError, type CmsDatabase } from './contract.ts';
import { authIdentitySchemaStatements, authIdentitySchemaObjects } from '../auth/identity-migrations.ts';
import { authSchemaStatements } from '../auth/schema.ts';
import { pendingTrashIndexStatements } from './trash-index.ts';
import { schemaMigration } from './schema-migrations.ts';
import { migrationObjects, normalizeMigrationSql, type CmsMigrationProvider } from './migration-provider.ts';
import { guardLifecycleIndexRepair, lifecycleMigration } from './lifecycle-migrations.ts';
import { ftsMetadataGuard, recognizeVersionedFtsOwner, type FtsCatalogueObject, type ReadOnlyOwnershipGuard, type RecognizedFtsOwner } from '../search/fts-ownership.ts';

function foundationStatements(database: CmsDatabase): CompiledQuery[] {
  const db = database.db;
  return [
    sql`CREATE TABLE _cms_collections (
      id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
      label_singular TEXT, description TEXT, supports TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`.compile(db),
    sql`CREATE TABLE _cms_fields (
      id TEXT PRIMARY KEY NOT NULL, collection_id TEXT NOT NULL REFERENCES _cms_collections(id),
      slug TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('string', 'text')),
      column_type TEXT NOT NULL CHECK(column_type = 'TEXT'),
      required INTEGER NOT NULL CHECK(required IN (0, 1)), "unique" INTEGER NOT NULL CHECK("unique" IN (0, 1)),
      default_value TEXT, validation TEXT, sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(collection_id, slug)
    )`.compile(db),
    sql`CREATE INDEX idx_cms_fields_collection ON _cms_fields(collection_id, sort_order)`.compile(db),
    sql`CREATE TABLE _cms_guards (token TEXT PRIMARY KEY NOT NULL, pass INTEGER NOT NULL CHECK(pass = 1))`.compile(db)];
}
export const CMS_MIGRATIONS: readonly CmsMigrationProvider[] = [
  { version: 1, name: 'foundation', async statements(database) { return foundationStatements(database); },
    async expectedObjects(database) { return migrationObjects(foundationStatements(database)); } },
  { version: 2, name: 'session-auth',
    async statements(database) { return authSchemaStatements(database.db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()); },
    async expectedObjects(database) { return migrationObjects(await this.statements(database)); } },
  schemaMigration,
  {version:4,name:'auth-identity',async statements(database) {return authIdentitySchemaStatements(database.db);},
    async expectedObjects(database) {return authIdentitySchemaObjects(database.db);}},
  lifecycleMigration, optionsMigration, taxonomyMigration, metadataFidelityMigration
];
export const CMS_MIGRATION_VERSION = CMS_MIGRATIONS.at(-1)!.version;
const trackingStatement = (database: CmsDatabase) =>
  sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.compile(database.db);

interface ValidatedMigrationState { version: number; prerequisiteGuard: CompiledQuery }
interface PrerequisiteObject { name: string; type: string; sql: string | null }
const prerequisiteChanged = 'sveltery-cms-migration-prerequisite-changed';

/** Validate the old layout before intentional provider upgrades change its DDL. */
function ownershipCondition(guard: ReadOnlyOwnershipGuard) {
  const parts=guard.sql.split('?');
  return sql.join(parts.flatMap((part,index)=>index<guard.parameters.length ? [sql.raw(part),sql`${guard.parameters[index]}`] : [sql.raw(part)]),sql``);
}

function prerequisiteGuard(database: CmsDatabase, version: number, names: readonly string[], rows: readonly PrerequisiteObject[], managed: readonly RecognizedFtsOwner[] = []) {
  const triggers=managed.flatMap(owner=>owner.objects.filter(object=>object.type==='trigger').map(object=>object.name));
  const guardedNames=[...names,...managed.flatMap(owner=>owner.objects.filter(object=>object.type!=='trigger').map(object=>object.name))];
  const temporary = sql`lower(name) GLOB '_cms_*' AND length(rtrim(name,'0123456789')) < length(name)
    AND rtrim(lower(name),'0123456789') GLOB '_cms_*_v'`;
  const selected = sql`(type <> 'trigger' AND lower(name) IN (SELECT value FROM json_each(${JSON.stringify(guardedNames)}))) OR (${temporary})
    ${triggers.length ? sql`OR (type='trigger' AND name IN (SELECT value FROM json_each(${JSON.stringify(triggers)})))` : sql``}
    ${version === 0 ? sql`OR name LIKE '_cms_%'` : sql``}`;
  const snapshot = JSON.stringify(rows.filter(row => row.type !== 'trigger' ? guardedNames.includes(row.name.toLowerCase()) : triggers.includes(row.name))
    .map(({name,type,sql}) => ({name,type,sql}))
    .sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
  const versions = version === 0 ? sql`${'[]'}` : sql`(SELECT json_group_array(version)
    FROM (SELECT version FROM _cms_migrations ORDER BY version))`;
  // This read-only guard also works before the foundation/guard tables exist.
  // A bad JSON path aborts the atomic batch before its first startup write.
  return sql`SELECT json_extract('[]', CASE WHEN
    (SELECT json_group_array(json_object('name',name,'type',type,'sql',sql)) FROM
      (SELECT name,type,sql FROM sqlite_master WHERE ${selected} ORDER BY name,type)) = ${snapshot}
    AND ${versions} = ${JSON.stringify(Array.from({length:version},(_,index)=>index+1))}
    ${managed.length ? sql`AND (${ownershipCondition(ftsMetadataGuard(managed.map(group=>group.owner)))})` : sql``}
    THEN '$' ELSE ${prerequisiteChanged} END)`.compile(database.db);
}

function validateObjects(rows: readonly PrerequisiteObject[], expected: ReadonlyMap<string,PrerequisiteObject>, owned: ReadonlySet<string>, managedTables: ReadonlySet<string> = new Set()) {
  const objects=new Map(rows.filter(row=>row.type!=='trigger').map(row=>[row.name,row]));
  for (const object of rows) {
    const name=object.name;
    if (/^_cms_.*_v[0-9]+$/i.test(name) && !(object.type==='table' && managedTables.has(name))) throw new CmsError('MIGRATION_REQUIRED');
    if (object.type==='trigger') continue;
    if (owned.has(name.toLowerCase()) && name!=='_cms_migrations' && !expected.has(name)) throw new CmsError('MIGRATION_REQUIRED');
    const wanted=expected.get(name);
    if (wanted && (wanted.type!==object.type || normalizeMigrationSql(wanted.sql ?? '')!==normalizeMigrationSql(object.sql ?? ''))) throw new CmsError('MIGRATION_REQUIRED');
  }
  if ([...expected.keys()].some(name=>!objects.has(name))) throw new CmsError('MIGRATION_REQUIRED');
}

/** Ownership is read only after all installed static metadata layouts validate. */
async function managedFtsOwners(database:CmsDatabase, rows:readonly FtsCatalogueObject[], candidates:ReadonlySet<string>) {
  if (!candidates.size) return [];
  const columns=(await sql<{name:string}>`PRAGMA table_info(_cms_collections)`.execute(database.db)).rows;
  if (!columns.some(column=>column.name==='search_config')) throw new CmsError('MIGRATION_REQUIRED');
  const managed:RecognizedFtsOwner[]=[];
  for(const table of candidates) {
    const slug=table.slice('_cms_fts_'.length);
    const owner=(await sql<{id:string;slug:string;search_config:string|null}>`SELECT id,slug,search_config FROM _cms_collections WHERE slug=${slug}`.execute(database.db)).rows[0];
    if (!owner) throw new CmsError('MIGRATION_REQUIRED');
    const fields=(await sql<{slug:string;type:string;searchable:number}>`SELECT slug,type,searchable FROM _cms_fields WHERE collection_id=${owner.id}`.execute(database.db)).rows;
    const tables=new Set(['','_data','_idx','_content','_docsize','_config'].map(suffix=>table+suffix));
    const triggers=new Set(['_insert','_update','_delete'].map(suffix=>table+suffix));
    // SQLite trigger names occupy their own namespace. An operator table with
    // a trigger's name is not part of the managed group, or vice versa.
    const group=rows.filter(object=>object.type==='trigger' ? triggers.has(object.name) : tables.has(object.name));
    const recognized=recognizeVersionedFtsOwner({id:owner.id,slug:owner.slug,searchConfig:owner.search_config,fields},group);
    if (!recognized) throw new CmsError('MIGRATION_REQUIRED');
    managed.push(recognized);
  }
  return managed;
}

async function migrationState(database: CmsDatabase): Promise<ValidatedMigrationState> {
  const db = database.db;
  const staticNames = new Set(['_cms_migrations']);
  // Version zero descriptors declare every static name, including future
  // provider objects, without reading metadata tables which may not exist.
  const staticObjects=new Map<CmsMigrationProvider,Awaited<ReturnType<CmsMigrationProvider['expectedObjects']>>>();
  for (const provider of CMS_MIGRATIONS) {
    const descriptors=await provider.expectedObjects(database,0);
    staticObjects.set(provider,descriptors);
    for (const object of descriptors) staticNames.add(object.name.toLowerCase());
  }
  const names = [...staticNames];
  const probe = await sql<{name: string; type: string}>`SELECT name,type FROM sqlite_master
    WHERE name LIKE '_cms_%' OR (type <> 'trigger' AND lower(name) IN (${sql.join(names)}))`.execute(db);
  if (!probe.rows.some(row => row.name === '_cms_migrations' && row.type === 'table')) {
    if (probe.rows.length) throw new CmsError('MIGRATION_REQUIRED');
    return {version:0,prerequisiteGuard:prerequisiteGuard(database,0,names,[])};
  }
  let rows;
  try {
    // Layout and all markers come from one SQLite statement snapshot. An
    // independent caller may commit between the probe and this snapshot.
    rows = (await sql<{name: string; type: string; tbl_name: string; sql: string; versions: string}>`SELECT name,type,tbl_name,sql,
      (SELECT json_group_array(version) FROM _cms_migrations) AS versions FROM sqlite_master`.execute(db)).rows;
  } catch (cause) {
    if (/no such (?:table|column):/.test(sqliteErrorMessage(cause) ?? '')) throw new CmsError('MIGRATION_REQUIRED');
    throw cause;
  }
  // Trigger names occupy a separate SQLite namespace and can equal table names.
  const objects = new Map(rows.filter(row=>row.type!=='trigger').map(row => [row.name,row]));
  const marker = objects.get('_cms_migrations');
  if (!marker || marker.type !== 'table') throw new CmsError('MIGRATION_REQUIRED');
  const versions: unknown = JSON.parse(marker.versions);
  if (!Array.isArray(versions)) throw new CmsError('MIGRATION_REQUIRED');
  const ordered = [...versions].sort((a,b) => a-b);
  const version = ordered.length;
  if (!version || version > CMS_MIGRATION_VERSION || ordered.some((value,index) => value !== index+1)) throw new CmsError('MIGRATION_REQUIRED');
  // Accept immutable historical tracking layouts only before the v3 upgrade.
  const tracking = normalizeMigrationSql(marker.sql ?? '');
  const validTracking = [normalizeMigrationSql(trackingStatement(database).sql)];
  if (version <= 2) validTracking.push('CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version = 1))',
    'CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version IN (1, 2)))');
  if (!validTracking.includes(tracking)) throw new CmsError('MIGRATION_REQUIRED');
  const expected = new Map<string,{name: string; type: string; sql: string}>();
  const owned = new Set(staticNames);
  // Resolve every installed static replacement before any dynamic provider
  // reads metadata. A later provider can supersede an earlier table layout.
  for (const provider of CMS_MIGRATIONS) if (provider.version<=version) {
    for (const object of staticObjects.get(provider)!) expected.set(object.name,object);
  }
  // Defer only a possible real FTS5 table. This grants no ownership until its
  // complete source-generated layout and registered metadata validate below.
  const candidates=new Set(rows.filter(object=>object.type==='table' && /^_cms_fts_[a-z][a-z0-9_]*_v[0-9]+$/.test(object.name)
    && /^CREATE\s+VIRTUAL\s+TABLE\b[\s\S]*\bUSING\s+fts5\s*\(/i.test(object.sql??'')).map(object=>object.name));
  validateObjects(rows,expected,owned,candidates);
  const managed=await managedFtsOwners(database,rows,candidates);
  for (const provider of CMS_MIGRATIONS) {
    if (provider.version>version) continue;
    const descriptors = await provider.expectedObjects(database,version);
    for (const object of descriptors) {
      owned.add(object.name.toLowerCase());
      expected.set(object.name,object);
    }
  }
  // Intermediate rebuild objects and partially-installed future providers are
  // rejected. No DROP/repair runs against an unknown layout.
  validateObjects(rows,expected,owned,new Set(managed.map(owner=>owner.table)));
  return {version,prerequisiteGuard:prerequisiteGuard(database,version,names,rows,managed)};
}

function prerequisiteRace(message: string | null | undefined) {
  return !!message && (message.includes(prerequisiteChanged) || /no such (?:table|column): (?:_cms_migrations|version)(?:$|\b)/.test(message));
}

async function installIndexes(database: CmsDatabase, state: ValidatedMigrationState) {
  const statements = await pendingTrashIndexStatements(database);
  if (!statements.length) return;
  const guarded=await guardLifecycleIndexRepair(database,statements);
  try { await database.atomicBatch([state.prerequisiteGuard,...guarded]); }
  catch (cause) {
    const message=sqliteErrorMessage(cause);
    if (message === 'CHECK constraint failed: pass = 1' || prerequisiteRace(message)) {
      // An exact concurrent index installer may win this snapshot. Accept it
      // only after revalidating the complete latest layout and every index.
      if ((await migrationState(database)).version===CMS_MIGRATION_VERSION&&
        !(await pendingTrashIndexStatements(database)).length) return;
      throw new CmsError('MIGRATION_REQUIRED');
    }
    throw cause;
  }
}

/** Explicit migrations preserve existing content; startup supplies no seed identity. */
export async function migrateCms(database: CmsDatabase): Promise<void> {
  const validated = await migrationState(database);
  const state = validated.version;
  if (state === CMS_MIGRATION_VERSION) { await installIndexes(database,validated); return; }
  const db = database.db;
  const statements: CompiledQuery[] = state === 0 ? [trackingStatement(database)] : [
    // A stale caller must roll back all DDL. Its race is recovered only after a
    // fresh snapshot proves the complete latest schema and contiguous markers.
    sql`INSERT INTO _cms_guards(token, pass) SELECT 'migration-upgrade', CASE WHEN
      (SELECT COUNT(*) FROM _cms_migrations) = ${state} AND
      (SELECT MAX(version) FROM _cms_migrations) = ${state} THEN 1 ELSE 0 END`.compile(db),
    sql`ALTER TABLE _cms_migrations RENAME TO _cms_migrations_v1`.compile(db),
    trackingStatement(database),
    sql`INSERT INTO _cms_migrations (version) SELECT version FROM _cms_migrations_v1`.compile(db),
    sql`DROP TABLE _cms_migrations_v1`.compile(db)
  ];
  statements.unshift(validated.prerequisiteGuard);
  const indexes = state > 0 ? await pendingTrashIndexStatements(database) : [];
  for (const provider of CMS_MIGRATIONS) {
    if (provider.version <= state) continue;
    statements.push(...await provider.statements(database),
      sql`INSERT INTO _cms_migrations (version) VALUES (${sql.lit(provider.version)})`.compile(db));
  }
  if (state > 0) statements.push(sql`DELETE FROM _cms_guards WHERE token = 'migration-upgrade'`.compile(db));
  statements.push(...indexes);
  try { await database.atomicBatch(statements); }
  catch (cause) {
    const message = sqliteErrorMessage(cause);
    const race = message === 'CHECK constraint failed: pass = 1' ||
      prerequisiteRace(message) ||
      (state === 0 && message === 'table _cms_migrations already exists');
    if (race) {
      const current = await migrationState(database);
      if (current.version === CMS_MIGRATION_VERSION) { await installIndexes(database,current); return; }
      if (current.version === state) {
        if (indexes.length) await pendingTrashIndexStatements(database);
        throw new CmsError('MIGRATION_REQUIRED');
      }
    }
    throw cause;
  }
}
