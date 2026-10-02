import { sql, type CompiledQuery } from 'kysely';
import { sqliteErrorMessage } from './errors.ts';
import { CmsError, type CmsDatabase } from './contract.ts';
import { authSchemaStatements } from '../auth/schema.ts';
import { pendingTrashIndexStatements } from './trash-index.ts';

export const CMS_MIGRATION_VERSION = 2;
const coreTables = ['_cms_collections', '_cms_fields', '_cms_guards'];
const migrationTemp = '_cms_migrations_v1';
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');

async function migrationState(database: CmsDatabase): Promise<0 | 1 | 2> {
  const db = database.db;
  const names = [...coreTables, '_cms_migrations', migrationTemp, '_cms_auth_users', '_cms_auth_sessions', 'idx_cms_auth_sessions_user'];
  const probe = await db.selectFrom(sql<{ name: string; type: string }>`sqlite_master`.as('objects'))
    .select(['name', 'type']).where('name', 'in', names).execute();
  if (!probe.some(row => row.name === '_cms_migrations' && row.type === 'table')) {
    if (probe.length) throw new CmsError('MIGRATION_REQUIRED');
    return 0;
  }
  // Object layout and marker values must come from one statement snapshot.
  // A concurrent upgrade may commit between the probe and this read, but cannot split this read.
  let rows;
  try {
    rows = await db.selectFrom(sql<{ name: string; type: string; sql: string }>`sqlite_master`.as('objects'))
      .select(['name', 'type', 'sql'])
      .select([
        sql<number>`(SELECT COUNT(*) FROM _cms_migrations)`.as('version_count'),
        sql<number>`(SELECT MIN(version) FROM _cms_migrations)`.as('version_min'),
        sql<number>`(SELECT MAX(version) FROM _cms_migrations)`.as('version_max')
      ]).where('name', 'in', names).execute();
  } catch (cause) {
    // A malformed tracking table is an incomplete migration, not a repair opportunity.
    if (cause instanceof Error && /no such (?:table|column):/.test(cause.message)) throw new CmsError('MIGRATION_REQUIRED');
    throw cause;
  }
  const objects = new Map(rows.map(row => [row.name, row]));
  const marker = objects.get('_cms_migrations');
  if (!marker || marker.type !== 'table' || objects.has(migrationTemp) ||
    coreTables.some(name => objects.get(name)?.type !== 'table')) throw new CmsError('MIGRATION_REQUIRED');
  const authObjects = ['_cms_auth_users', '_cms_auth_sessions', 'idx_cms_auth_sessions_user'];
  if (marker.version_count === 1 && marker.version_min === 1 && marker.version_max === 1) {
    if (authObjects.some(name => objects.has(name))) throw new CmsError('MIGRATION_REQUIRED');
    return 1;
  }
  if (marker.version_count !== 2 || marker.version_min !== 1 || marker.version_max !== 2) throw new CmsError('MIGRATION_REQUIRED');
  // Verify the registered auth contract, including constraints, foreign key and lookup index.
  // This is a bounded known-DDL check, not general database corruption recovery.
  const expected = authSchemaStatements(db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>());
  for (let index = 0; index < authObjects.length; index++) {
    const row = objects.get(authObjects[index]);
    if (!row || normalize(row.sql ?? '') !== normalize(expected[index].sql)) throw new CmsError('MIGRATION_REQUIRED');
  }
  return 2;
}

/** Explicit operator-run migrations; no users, credentials, defaults or sessions are inserted. */
export async function migrateCms(database: CmsDatabase): Promise<void> {
  const state = await migrationState(database);
  if (state === CMS_MIGRATION_VERSION) {
    const indexes = await pendingTrashIndexStatements(database);
    if (indexes.length) {
      try { await database.atomicBatch(indexes); }
      catch (cause) {
        if (sqliteErrorMessage(cause) === 'CHECK constraint failed: pass = 1') throw new CmsError('MIGRATION_REQUIRED');
        throw cause;
      }
    }
    return;
  }
  const db = database.db;
  const tracking = sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version IN (1, 2)))`.compile(db);
  const statements: CompiledQuery[] = state === 0 ? [tracking,
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
    sql`CREATE TABLE _cms_guards (token TEXT PRIMARY KEY NOT NULL, pass INTEGER NOT NULL CHECK(pass = 1))`.compile(db),
    sql`INSERT INTO _cms_migrations (version) VALUES (1)`.compile(db)
  ] : [
    // Checked inside the adapter's transaction, so a stale concurrent upgrader rolls back.
    sql`INSERT INTO _cms_guards(token, pass) SELECT 'migration-v2', CASE WHEN
      (SELECT COUNT(*) FROM _cms_migrations) = 1 AND
      EXISTS (SELECT 1 FROM _cms_migrations WHERE version = 1) THEN 1 ELSE 0 END`.compile(db),
    sql`ALTER TABLE _cms_migrations RENAME TO _cms_migrations_v1`.compile(db),
    tracking,
    sql`INSERT INTO _cms_migrations (version) SELECT version FROM _cms_migrations_v1`.compile(db),
    sql`DROP TABLE _cms_migrations_v1`.compile(db),
    sql`DELETE FROM _cms_guards WHERE token = 'migration-v2'`.compile(db)
  ];
  const indexes = state === 1 ? await pendingTrashIndexStatements(database) : [];
  statements.push(...authSchemaStatements(db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()),
    sql`INSERT INTO _cms_migrations (version) VALUES (2)`.compile(db),
    ...indexes);
  try { await database.atomicBatch(statements); }
  catch (cause) {
    // Recover only a known migration race after proving the complete committed schema.
    const message = sqliteErrorMessage(cause);
    const race = state === 0 ? message === 'table _cms_migrations already exists' : message === 'CHECK constraint failed: pass = 1';
    if (race) {
      const current = await migrationState(database);
      if (current === CMS_MIGRATION_VERSION) {
        const pending = await pendingTrashIndexStatements(database);
        if (pending.length) await database.atomicBatch(pending);
        return;
      }
      // A late incompatible index can fail its guard after the v1 upgrade has
      // started. Its whole batch rolled back; classify only a verified collision.
      if (current === 1 && indexes.length) await pendingTrashIndexStatements(database);
    }
    throw cause;
  }
}
