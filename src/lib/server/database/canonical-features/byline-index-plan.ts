// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source031 and Source SchemaRegistry primary-byline index; Native atomic guards.
import { sql, type CompiledQuery } from 'kysely';
import { CmsError, type CmsDatabase } from '../contract.ts';
import type { MigrationObject } from '../migration-provider.ts';
import { identifier, parse, tableName } from '../validation.ts';

export const bylineIndexPrerequisiteChanged = 'sveltery-cms-byline-index-prerequisite-changed';
export function primaryBylineIndexStatement(database: CmsDatabase, slug: string) {
  const table = tableName(parse(identifier, slug));
  return sql`CREATE INDEX ${sql.ref(`idx_${table}_primary_byline`)} ON ${sql.ref(table)} (primary_byline_id)`.compile(database.db);
}
function guard(database: CmsDatabase, query: ReturnType<typeof versionSnapshotQuery>, snapshot: string) {
  return sql`SELECT json_extract('[]', CASE WHEN (${query})=${snapshot}
    THEN '$' ELSE ${bylineIndexPrerequisiteChanged} END)`.compile(database.db);
}
function versionSnapshotQuery() {
  return sql<{ snapshot: string }>`SELECT json_group_array(version) AS snapshot FROM (SELECT version FROM _cms_migrations ORDER BY version)`;
}
function orderedVersions(snapshot: string): number[] {
  const parsed: unknown = JSON.parse(snapshot);
  if (!Array.isArray(parsed) || parsed.some((version, index) => version !== index + 1)) throw new CmsError('MIGRATION_REQUIRED');
  return parsed as number[];
}
const catalogueQuery = sql<{ snapshot: string }>`SELECT json_group_array(json_object('name',name,'type',type,'sql',sql)) AS snapshot
  FROM (SELECT name,type,sql FROM sqlite_master WHERE name IN ('_cms_collections','_cms_migrations') AND type <> 'trigger' ORDER BY name,type)`;

/** Real pending Source031 additions, never a standalone installer or request DDL. */
export async function planPrimaryBylineIndexes(database: CmsDatabase): Promise<{
  guards: readonly CompiledQuery[]; statements: readonly CompiledQuery[];
}> {
  const receipt = (await catalogueQuery.execute(database.db)).rows[0].snapshot;
  const catalogue = JSON.parse(receipt) as { name: string; type: string; sql: string | null }[];
  const guards: CompiledQuery[] = [guard(database, catalogueQuery, receipt)], statements: CompiledQuery[] = [];
  if (!catalogue.length) return { guards, statements };
  if (catalogue.length !== 2 || catalogue.some(object => object.type !== 'table')) throw new CmsError('MIGRATION_REQUIRED');
  const versionsQuery = versionSnapshotQuery(), versionReceipt = (await versionsQuery.execute(database.db)).rows[0].snapshot;
  const versions = orderedVersions(versionReceipt);
  guards.push(guard(database, versionsQuery, versionReceipt));
  const collectionQuery = sql<{ snapshot: string }>`SELECT json_group_array(json_object('id',id,'slug',slug,'version',version)) AS snapshot
    FROM (SELECT id,slug,version FROM _cms_collections ORDER BY slug)`;
  const collectionReceipt = (await collectionQuery.execute(database.db)).rows[0].snapshot;
  guards.push(guard(database, collectionQuery, collectionReceipt));
  const collections = JSON.parse(collectionReceipt) as { id: string; slug: string; version: number }[];
  if (collections.length > 100) throw new CmsError('MIGRATION_REQUIRED');
  for (const collection of collections) {
    const slug = parse(identifier, collection.slug), table = tableName(slug), name = `idx_${table}_primary_byline`;
    const objectsQuery = sql<{ snapshot: string }>`SELECT json_group_array(json_object('name',name,'type',type,'sql',sql)) AS snapshot FROM
      (SELECT name,type,sql FROM sqlite_master WHERE type <> 'trigger' AND
        (name=${table} COLLATE NOCASE OR name=${name} COLLATE NOCASE) ORDER BY name,type)`;
    const objectsReceipt = (await objectsQuery.execute(database.db)).rows[0].snapshot;
    guards.push(guard(database, objectsQuery, objectsReceipt));
    const objects = JSON.parse(objectsReceipt) as { name: string; type: string; sql: string | null }[];
    // A future-owned index already present is an operator/partial-installation
    // collision. Preserve it and refuse; Source031 would not overwrite it.
    if (objects.length !== 1 || objects[0].name !== table || objects[0].type !== 'table') throw new CmsError('MIGRATION_REQUIRED');
    const columns = (await sql<{ name: string; type: string }>`PRAGMA table_info(${sql.id(table)})`.execute(database.db)).rows;
    const byline = columns.find(column => column.name === 'primary_byline_id');
    if (byline ? byline.type !== 'TEXT' : versions.length >= 5) throw new CmsError('MIGRATION_REQUIRED');
    // Before5, the genuine pending frozen lifecycle provider adds this column.
    statements.push(primaryBylineIndexStatement(database, slug));
  }
  return { guards, statements };
}

/** Only actual installed9+ declares dynamic Source031 index ownership. */
export async function expectedPrimaryBylineIndexes(database: CmsDatabase, installedVersion: number): Promise<readonly MigrationObject[]> {
  if (installedVersion < 9) return [];
  const collections = await database.db.selectFrom('_cms_collections').select('slug').orderBy('slug').execute();
  if (collections.length > 100) throw new CmsError('MIGRATION_REQUIRED');
  return collections.map(collection => {
    const slug = parse(identifier, collection.slug), table = tableName(slug);
    return { name: `idx_${table}_primary_byline`, type: 'index', sql: primaryBylineIndexStatement(database, slug).sql };
  });
}

/**
 * Native new-collection seam: <=8 retains its historical behavior;9+ creates
 * the real Source index. A marker snapshot prevents an old creator from adding
 * an unindexed collection after a newer canonical installer commits.
 */
export async function collectionPrimaryBylinePlan(database: CmsDatabase, slug: string): Promise<{
  guard: CompiledQuery; index: CompiledQuery | null;
}> {
  const query = versionSnapshotQuery(), receipt = (await query.execute(database.db)).rows[0].snapshot;
  const versions = orderedVersions(receipt);
  return { guard: guard(database, query, receipt), index: versions.length >= 9 ? primaryBylineIndexStatement(database, slug) : null };
}
