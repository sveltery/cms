import { sql, type CompiledQuery } from 'kysely';
import { ulid } from 'ulidx';
import { CmsError, type CmsDatabase } from './contract.ts';
import { identifier, parse, tableName } from './validation.ts';

export function trashIndexStatement(database: CmsDatabase, slug: string, ifNotExists = false) {
  const table = tableName(slug);
  // Pinned SchemaRegistry.createContentTable uses this deleted-leading index.
  // Retain upstream's final-term ID sort rather than adding a no-sort optimization.
  return sql`${ifNotExists ? sql`CREATE INDEX IF NOT EXISTS` : sql`CREATE INDEX`} ${sql.ref('idx_' + table + '_deleted_status')}
    ON ${sql.ref(table)} (deleted_at, status)`.compile(database.db);
}
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');

/** Called only after migrateCms validates the existing system/auth state. */
export async function pendingTrashIndexStatements(database: CmsDatabase) {
  const collections = await database.db.selectFrom('_cms_collections').select('slug').orderBy('slug').limit(101).execute();
  if (collections.length > 100) throw new CmsError('MIGRATION_REQUIRED');
  const statements: CompiledQuery[] = [];
  for (const collection of collections) {
    const slug = parse(identifier, collection.slug); const table = tableName(slug);
    const name = 'idx_' + table + '_deleted_status';
    const expected = trashIndexStatement(database, slug);
    const existing = (await sql<{ type: string; tbl_name: string; sql: string }>`SELECT type, tbl_name, sql
      FROM sqlite_master WHERE name = ${name}`.execute(database.db)).rows[0];
    if (existing) {
      if (existing.type !== 'index' || existing.tbl_name !== table || normalize(existing.sql ?? '') !== normalize(expected.sql)) {
        throw new CmsError('MIGRATION_REQUIRED');
      }
      continue;
    }
    const token = ulid();
    // Another installer may commit after preflight. Accept only this exact index,
    // and roll back all additions if an incompatible object wins that name.
    statements.push(sql`INSERT INTO _cms_guards(token, pass) SELECT ${token}, CASE WHEN
      NOT EXISTS (SELECT 1 FROM sqlite_master WHERE name = ${name}) OR
      EXISTS (SELECT 1 FROM sqlite_master WHERE name = ${name} AND type = 'index'
        AND tbl_name = ${table} AND sql = ${expected.sql}) THEN 1 ELSE 0 END`.compile(database.db),
      trashIndexStatement(database, slug, true),
      sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(database.db));
  }
  return statements;
}
