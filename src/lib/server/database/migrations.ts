import { sql } from 'kysely';
import { CmsError, type CmsDatabase } from './contract.ts';

// Forward-only, bounded system migration. User schema changes use the registry.
export async function migrateCms(database: CmsDatabase): Promise<void> {
  const db = database.db;
  const exists = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_cms_migrations'`.execute(db);
  if (exists.rows.length) {
    const versions = await db.selectFrom('_cms_migrations').select('version').orderBy('version').limit(2).execute();
    if (versions.length !== 1 || versions[0].version !== 1) throw new CmsError('MIGRATION_REQUIRED');
    const tables = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type = 'table'
      AND name IN ('_cms_collections', '_cms_fields', '_cms_guards')`.execute(db);
    if (tables.rows.length !== 3) throw new CmsError('MIGRATION_REQUIRED');
    return;
  }
  const unmanaged = await sql`SELECT name FROM sqlite_master WHERE name IN ('_cms_collections', '_cms_fields', '_cms_guards') LIMIT 1`.execute(db);
  if (unmanaged.rows.length) throw new CmsError('MIGRATION_REQUIRED');
  await database.atomicBatch([
    sql`CREATE TABLE IF NOT EXISTS _cms_migrations (version INTEGER PRIMARY KEY CHECK(version = 1))`.compile(db),
    sql`CREATE TABLE IF NOT EXISTS _cms_collections (
      id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
      label_singular TEXT, description TEXT, supports TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`.compile(db),
    sql`CREATE TABLE IF NOT EXISTS _cms_fields (
      id TEXT PRIMARY KEY NOT NULL, collection_id TEXT NOT NULL REFERENCES _cms_collections(id),
      slug TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('string', 'text')),
      column_type TEXT NOT NULL CHECK(column_type = 'TEXT'),
      required INTEGER NOT NULL CHECK(required IN (0, 1)), "unique" INTEGER NOT NULL CHECK("unique" IN (0, 1)),
      default_value TEXT, validation TEXT, sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(collection_id, slug)
    )`.compile(db),
    sql`CREATE INDEX IF NOT EXISTS idx_cms_fields_collection ON _cms_fields(collection_id, sort_order)`.compile(db),
    sql`CREATE TABLE IF NOT EXISTS _cms_guards (token TEXT PRIMARY KEY NOT NULL, pass INTEGER NOT NULL CHECK(pass = 1))`.compile(db),
    sql`INSERT OR IGNORE INTO _cms_migrations (version) VALUES (1)`.compile(db)
  ]);
}
