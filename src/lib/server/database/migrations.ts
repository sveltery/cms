import { sql, type CompiledQuery } from 'kysely';
import { sqliteErrorMessage } from './errors.ts';
import { CmsError, type CmsDatabase } from './contract.ts';
import { authIdentitySchemaStatements, authIdentitySchemaObjects } from '../auth/identity-migrations.ts';
import { authSchemaStatements } from '../auth/schema.ts';
import { pendingTrashIndexStatements } from './trash-index.ts';
import { schemaMigration } from './schema-migrations.ts';
import { migrationObjects, normalizeMigrationSql, type CmsMigrationProvider } from './migration-provider.ts';

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
    async expectedObjects(database) {return authIdentitySchemaObjects(database.db);}}
];
export const CMS_MIGRATION_VERSION = CMS_MIGRATIONS.at(-1)!.version;
const trackingStatement = (database: CmsDatabase) =>
  sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.compile(database.db);

async function migrationState(database: CmsDatabase): Promise<number> {
  const db = database.db;
  const probe = await sql<{name: string; type: string}>`SELECT name,type FROM sqlite_master
    WHERE name LIKE '_cms_%' OR name = 'idx_cms_auth_sessions_user' OR name = 'idx_cms_fields_collection'`.execute(db);
  if (!probe.rows.some(row => row.name === '_cms_migrations' && row.type === 'table')) {
    if (probe.rows.length) throw new CmsError('MIGRATION_REQUIRED');
    return 0;
  }
  let rows;
  try {
    // Layout and all markers come from one SQLite statement snapshot. An
    // independent caller may commit between the probe and this snapshot.
    rows = (await sql<{name: string; type: string; sql: string; versions: string}>`SELECT name,type,sql,
      (SELECT json_group_array(version) FROM _cms_migrations) AS versions FROM sqlite_master`.execute(db)).rows;
  } catch (cause) {
    if (/no such (?:table|column):/.test(sqliteErrorMessage(cause) ?? '')) throw new CmsError('MIGRATION_REQUIRED');
    throw cause;
  }
  const objects = new Map(rows.map(row => [row.name,row]));
  const marker = objects.get('_cms_migrations');
  if (!marker || marker.type !== 'table') throw new CmsError('MIGRATION_REQUIRED');
  const versions: unknown = JSON.parse(marker.versions);
  if (!Array.isArray(versions)) throw new CmsError('MIGRATION_REQUIRED');
  const ordered = [...versions].sort((a,b) => a-b);
  const version = ordered.length;
  if (!version || version > CMS_MIGRATION_VERSION || ordered.some((value,index) => value !== index+1)) throw new CmsError('MIGRATION_REQUIRED');
  const expected = new Map<string,{name: string; type: string; sql: string}>();
  const owned = new Set(['_cms_migrations']);
  for (const provider of CMS_MIGRATIONS) {
    const descriptors = await provider.expectedObjects(database);
    for (const object of descriptors) {
      owned.add(object.name);
      if (provider.version <= version) expected.set(object.name,object);
    }
  }
  // Intermediate rebuild objects and partially-installed future providers are
  // rejected. No DROP/repair runs against an unknown layout.
  for (const [name,object] of objects) {
    if (/^_cms_.*_v[0-9]+$/.test(name) || (owned.has(name) && name !== '_cms_migrations' && !expected.has(name))) throw new CmsError('MIGRATION_REQUIRED');
    const wanted = expected.get(name);
    if (wanted && (wanted.type !== object.type || normalizeMigrationSql(wanted.sql) !== normalizeMigrationSql(object.sql ?? ''))) throw new CmsError('MIGRATION_REQUIRED');
  }
  if ([...expected.keys()].some(name => !objects.has(name))) throw new CmsError('MIGRATION_REQUIRED');
  // Accept immutable historical tracking layouts only before the v3 upgrade.
  const tracking = normalizeMigrationSql(marker.sql ?? '');
  const validTracking = [normalizeMigrationSql(trackingStatement(database).sql)];
  if (version <= 2) validTracking.push('CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version = 1))',
    'CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version IN (1, 2)))');
  if (!validTracking.includes(tracking)) throw new CmsError('MIGRATION_REQUIRED');
  return version;
}

async function installIndexes(database: CmsDatabase) {
  const statements = await pendingTrashIndexStatements(database);
  if (!statements.length) return;
  try { await database.atomicBatch(statements); }
  catch (cause) {
    if (sqliteErrorMessage(cause) === 'CHECK constraint failed: pass = 1') throw new CmsError('MIGRATION_REQUIRED');
    throw cause;
  }
}

/** Explicit migrations preserve existing content; startup supplies no seed identity. */
export async function migrateCms(database: CmsDatabase): Promise<void> {
  const state = await migrationState(database);
  if (state === CMS_MIGRATION_VERSION) { await installIndexes(database); return; }
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
    const race = state === 0 ? message === 'table _cms_migrations already exists' : message === 'CHECK constraint failed: pass = 1';
    if (race) {
      const current = await migrationState(database);
      if (current === CMS_MIGRATION_VERSION) { await installIndexes(database); return; }
      if (current === state && indexes.length) await pendingTrashIndexStatements(database);
    }
    throw cause;
  }
}
