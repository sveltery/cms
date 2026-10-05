// Source SchemaRegistry.createContentTable:1914-2006, EmDash 1.1.0 pin
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import { sql, type CompiledQuery } from 'kysely';
import { CmsError, type CmsDatabase } from './contract.ts';
import { tableName } from './validation.ts';

/** Fourteen Source indexes; deleted-status and primary-byline keep their existing owners. */
export function collectionStandardIndexStatements(database: CmsDatabase, slug: string,
  installedVersion: number): readonly CompiledQuery[] {
  if (installedVersion < 16) return [];
  const table = tableName(slug), db = database.db;
  return [
    sql`CREATE INDEX ${sql.ref(`idx_${table}_slug`)} ON ${sql.ref(table)} (slug)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_del_sched`)} ON ${sql.ref(table)}
      (deleted_at, scheduled_at) WHERE scheduled_at IS NOT NULL`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_live_revision`)} ON ${sql.ref(table)} (live_revision_id)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_draft_revision`)} ON ${sql.ref(table)} (draft_revision_id)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_author`)} ON ${sql.ref(table)} (author_id)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_locale`)} ON ${sql.ref(table)} (locale)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_tg_locale`)} ON ${sql.ref(table)}
      (translation_group, locale)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_del_tg_locale`)} ON ${sql.ref(table)}
      (deleted_at, translation_group, locale)`.compile(db),
    sql`CREATE UNIQUE INDEX ${sql.ref(`uidx_${table}_active_tg_locale`)} ON ${sql.ref(table)}
      (translation_group, lower(locale)) WHERE deleted_at IS NULL AND translation_group IS NOT NULL`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_deleted_updated_id`)} ON ${sql.ref(table)}
      (deleted_at, updated_at DESC, id DESC)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_deleted_created_id`)} ON ${sql.ref(table)}
      (deleted_at, created_at DESC, id DESC)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_deleted_published_id`)} ON ${sql.ref(table)}
      (deleted_at, published_at DESC, id DESC)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_loc_upd`)} ON ${sql.ref(table)}
      (deleted_at, locale, updated_at DESC, id DESC)`.compile(db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_loc_crt`)} ON ${sql.ref(table)}
      (deleted_at, locale, created_at DESC, id DESC)`.compile(db)
  ];
}

export const collectionIndexPrerequisiteChanged = 'sveltery-cms-collection-index-prerequisite-changed';

/** New creator admission; frozen byline producer/snapshot remain untouched. */
export async function collectionStandardIndexPlan(database:CmsDatabase, slug:string) {
  const query=sql<{snapshot:string}>`SELECT json_group_array(version) AS snapshot FROM (SELECT version FROM _cms_migrations ORDER BY version)`;
  const receipt=(await query.execute(database.db)).rows[0].snapshot;
  const versions:unknown=JSON.parse(receipt);
  if (!Array.isArray(versions) || !versions.length || versions.length>16 ||
    versions.some((version,index)=>version!==index+1)) throw new CmsError('MIGRATION_REQUIRED');
  return {guard:sql`SELECT json_extract('[]', CASE WHEN (${query})=${receipt}
    THEN '$' ELSE ${collectionIndexPrerequisiteChanged} END)`.compile(database.db),
    indexes:collectionStandardIndexStatements(database,slug,versions.length)};
}
