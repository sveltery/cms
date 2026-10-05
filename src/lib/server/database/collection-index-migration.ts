// Source SchemaRegistry standard16 and whole Source055/074/080, EmDash1.1.0
// pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Native planning/ownership/atomic guards; canonical content_taxonomies rename.
import { sql, type CompiledQuery } from 'kysely';
import { CmsError, type CmsDatabase } from './contract.ts';
import { identifier, parse, tableName } from './validation.ts';
import { migrationObjects, normalizeMigrationSql, type CmsMigrationProvider } from './migration-provider.ts';
import { collectionStandardIndexStatements, collectionIndexPrerequisiteChanged } from './collection-indexes.ts';
import { normalizeFeatureStorageSql } from './canonical-features/sql-recognition.ts';
import { atomicQueryLoop } from './atomic-query-loop.ts';
import { optionsMigration } from './options-migrations.ts';
import { mediaAttributionMigration,commentsMigration,redirectsMigration } from './canonical-features/providers.ts';

function snapshotGuard(database: CmsDatabase, query: ReturnType<typeof contentSnapshotQuery>, snapshot: string) {
  return sql`SELECT json_extract('[]', CASE WHEN (${query})=${snapshot}
    THEN '$' ELSE ${collectionIndexPrerequisiteChanged} END)`.compile(database.db);
}
function contentSnapshotQuery(table: string) {
  return sql<{snapshot:string}>`SELECT json_group_array(json_object('id',id,'translation_group',translation_group,
    'locale',locale,'created_at',created_at,'deleted_at',deleted_at)) AS snapshot
    FROM (SELECT id,translation_group,locale,created_at,deleted_at FROM ${sql.ref(table)} ORDER BY id)`;
}
const metadataSnapshotQuery = sql<{snapshot:string}>`SELECT json_group_array(json_object('id',id,'slug',slug,'version',version)) AS snapshot
  FROM (SELECT id,slug,version FROM _cms_collections ORDER BY slug)`;

interface DuplicateContentRow { id:string; translation_group:string; locale_key:string }
/**
 * Source080's actual SQL supplies every ordering/lower(locale) comparison.
 * Project prior planned group changes through one JSON binding: the source's
 * repeated 50-group reads can be prepared without any early database writes.
 * Each returned batch and full relevant-row snapshot share one SQL statement.
 */
function duplicatesQuery(table: string, groups: Record<string,string>) {
  return sql<{snapshot:string;duplicates:string}>`WITH content AS (
      SELECT id,coalesce((SELECT value FROM json_each(${JSON.stringify(groups)}) WHERE key=stored.id),translation_group) AS translation_group,
        locale,created_at,deleted_at FROM ${sql.ref(table)} AS stored
    ), duplicate_groups AS (
      SELECT translation_group,lower(locale) AS locale_key FROM content
      WHERE deleted_at IS NULL AND translation_group IS NOT NULL
      GROUP BY translation_group,lower(locale) HAVING COUNT(*)>1
      ORDER BY translation_group,lower(locale) LIMIT 50
    ) SELECT (${contentSnapshotQuery(table)}) AS snapshot,
      (SELECT json_group_array(json_object('id',id,'translation_group',translation_group,'locale_key',locale_key)) FROM (
        SELECT content.id,content.translation_group,lower(content.locale) AS locale_key FROM content
        INNER JOIN duplicate_groups AS duplicate ON duplicate.translation_group=content.translation_group
          AND duplicate.locale_key=lower(content.locale)
        WHERE content.deleted_at IS NULL
        ORDER BY content.translation_group,lower(content.locale),
          CASE WHEN content.id=content.translation_group THEN 0 ELSE 1 END,content.created_at,content.id
      )) AS duplicates`;
}

function actualDuplicatesQuery(table:string) {
  return sql<DuplicateContentRow>`WITH duplicate_groups AS (
    SELECT translation_group,lower(locale) AS locale_key FROM ${sql.ref(table)}
    WHERE deleted_at IS NULL AND translation_group IS NOT NULL
    GROUP BY translation_group,lower(locale) HAVING COUNT(*)>1
    ORDER BY translation_group,lower(locale) LIMIT 50
  ) SELECT content.id,content.translation_group,lower(content.locale) AS locale_key
    FROM ${sql.ref(table)} AS content INNER JOIN duplicate_groups AS duplicate
      ON duplicate.translation_group=content.translation_group AND duplicate.locale_key=lower(content.locale)
    WHERE content.deleted_at IS NULL
    ORDER BY content.translation_group,lower(content.locale),
      CASE WHEN content.id=content.translation_group THEN 0 ELSE 1 END,content.created_at,content.id`;
}

/** Both executors retain Source080's first-row anchor in each ordered group. */
function* rowsToSplit(duplicates:readonly DuplicateContentRow[]) {
  let previousGroupLocale:string|null=null;
  for (const row of duplicates) {
    const groupLocale=`${row.translation_group}\0${row.locale_key}`;
    if (groupLocale===previousGroupLocale) yield row;
    else previousGroupLocale=groupLocale;
  }
}

/** Actual Source080 body planning for each fresh, already-executed SQL read. */
function splitQueries(database:CmsDatabase, slug:string, duplicates:readonly DuplicateContentRow[]) {
  const statements:CompiledQuery[]=[],table=tableName(slug);
  for (const row of rowsToSplit(duplicates)) {
    statements.push(sql`INSERT INTO _cms_content_taxonomies(collection,entry_id,taxonomy_id)
      SELECT collection,${row.id},taxonomy_id FROM _cms_content_taxonomies
      WHERE collection=${slug} AND entry_id=${row.translation_group}
      ON CONFLICT(collection,entry_id,taxonomy_id) DO NOTHING`.compile(database.db),
      sql`UPDATE ${sql.ref(table)} SET translation_group=${row.id}
        WHERE id=${row.id} AND deleted_at IS NULL AND translation_group=${row.translation_group}
          AND lower(locale)=${row.locale_key}`.compile(database.db));
  }
  return statements;
}

async function planDuplicateLocales(database: CmsDatabase, slug: string) {
  const table = tableName(slug), groups:Record<string,string> = Object.create(null);
  const statements:CompiledQuery[] = [];
  const sourceQuery=actualDuplicatesQuery(table);
  if (database.atomicQueryLoops) {
    const snapshot=(await contentSnapshotQuery(table).execute(database.db)).rows[0].snapshot;
    // Always re-read after earlier pending provider writes, even if preparation
    // saw no duplicates. Admitted content/pivot/operator effects stay real.
    return {guard:snapshotGuard(database,contentSnapshotQuery(table),snapshot),statements:[
      atomicQueryLoop(sourceQuery.compile(database.db),rows=>splitQueries(database,slug,rows as DuplicateContentRow[]))
    ]};
  }
  // Fixed D1 batches cannot perform mutation-dependent JS loops. This is an
  // explicit incomplete capability boundary, not Source/D1 equivalence.
  const triggersQuery=sql<{snapshot:string}>`SELECT json_group_array(json_object('name',name,'tbl_name',tbl_name,'sql',sql)) AS snapshot
    FROM (SELECT name,tbl_name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name)`;
  const triggerSnapshot=(await triggersQuery.execute(database.db)).rows[0].snapshot;
  const owned=[...await optionsMigration.expectedTriggers(database),
    ...await mediaAttributionMigration.expectedTriggers(database),...await commentsMigration.expectedTriggers(database),
    ...await redirectsMigration.expectedTriggers(database)];
  const operators=JSON.parse(triggerSnapshot) as {name:string;sql:string}[];
  // Unknown triggers can influence content indirectly from any table. Existing
  // exact owned triggers are preserved; no operator is dropped or rewritten.
  if(operators.some(actual=>!owned.some(expected=>actual.name===expected.name&&
    normalizeFeatureStorageSql(actual.sql)===normalizeFeatureStorageSql(expected.sql)))) {
    throw new CmsError('MIGRATION_REQUIRED','This adapter cannot repair locales in a database with operator triggers');
  }
  const triggerGuard=snapshotGuard(database,triggersQuery,triggerSnapshot);
  let originalSnapshot:string|undefined;
  while (true) {
    const receipt = (await duplicatesQuery(table,groups).execute(database.db)).rows[0];
    if (originalSnapshot === undefined) originalSnapshot=receipt.snapshot;
    else if (originalSnapshot !== receipt.snapshot) throw new CmsError('MIGRATION_REQUIRED');
    const duplicates = JSON.parse(receipt.duplicates) as DuplicateContentRow[];
    if (!duplicates.length) {
      const contentGuard=snapshotGuard(database,contentSnapshotQuery(table),originalSnapshot);
      // Hoisted guards protect preflight. These repeated real guards protect
      // this provider's actual position after all earlier batch writes.
      return {guard:contentGuard,additionalGuards:[triggerGuard],
        statements:[triggerGuard,contentGuard,...statements]};
    }
    statements.push(...splitQueries(database,slug,duplicates));
    for (const row of rowsToSplit(duplicates)) groups[row.id]=row.id;
  }
}

function legacyIndexDefinitions(database:CmsDatabase, slug:string) {
  const table=tableName(slug);
  return [sql`CREATE INDEX ${sql.ref(`idx_${table}_translation_group`)} ON ${sql.ref(table)} (translation_group)`.compile(database.db),
    sql`CREATE INDEX ${sql.ref(`idx_${table}_scheduled`)} ON ${sql.ref(table)} (scheduled_at) WHERE scheduled_at IS NOT NULL`.compile(database.db)];
}

async function prepare(database:CmsDatabase) {
  const guards:CompiledQuery[]=[], statements:CompiledQuery[]=[];
  // Canonical startup may prepare before foundation exists. Refuse a changed
  // metadata presence before its first write, with a real catalogue snapshot.
  const presenceQuery=sql<{snapshot:string}>`SELECT json_group_array(json_object('name',name,'type',type,'sql',sql)) AS snapshot
    FROM (SELECT name,type,sql FROM sqlite_master WHERE name='_cms_collections' COLLATE NOCASE AND type<>'trigger' ORDER BY name,type)`;
  const presence=(await presenceQuery.execute(database.db)).rows[0].snapshot;
  guards.push(snapshotGuard(database,presenceQuery,presence));
  const objects=JSON.parse(presence) as {name:string;type:string}[];
  if (!objects.length) return {guards,statements};
  if (objects.length!==1 || objects[0].name!=='_cms_collections' || objects[0].type!=='table') throw new CmsError('MIGRATION_REQUIRED');
  const metadata=(await metadataSnapshotQuery.execute(database.db)).rows[0].snapshot;
  guards.push(snapshotGuard(database,metadataSnapshotQuery,metadata));
  for (const collection of JSON.parse(metadata) as {slug:string}[]) {
    const slug=parse(identifier,collection.slug),table=tableName(slug);
    const standard=collectionStandardIndexStatements(database,slug,16);
    const legacy=legacyIndexDefinitions(database,slug);
    const wanted=migrationObjects([...standard,...legacy]);
    const names=[table,...wanted.map(object=>object.name)];
    const catalogueQuery=sql<{snapshot:string}>`SELECT json_group_array(json_object('name',name,'type',type,'tbl_name',tbl_name,'sql',sql)) AS snapshot
      FROM (SELECT name,type,tbl_name,sql FROM sqlite_master WHERE type<>'trigger'
        AND lower(name) IN (SELECT lower(value) FROM json_each(${JSON.stringify(names)})) ORDER BY name,type)`;
    const catalogue=(await catalogueQuery.execute(database.db)).rows[0].snapshot;
    guards.push(snapshotGuard(database,catalogueQuery,catalogue));
    const actual=JSON.parse(catalogue) as {name:string;type:string;tbl_name:string;sql:string|null}[];
    if (!actual.some(object=>object.name===table && object.type==='table')) throw new CmsError('MIGRATION_REQUIRED');
    for (const object of actual.filter(object=>object.name!==table)) {
      const expected=migrationObjects(legacy).find(expected=>expected.name===object.name);
      // A future-owned operator/partial installation is refused, never adopted
      // or overwritten. Legacy replacements must have the Source exact shape.
      if (!expected || object.type!=='index' || object.tbl_name!==table ||
        normalizeFeatureStorageSql(normalizeMigrationSql(object.sql??''))!==
          normalizeFeatureStorageSql(normalizeMigrationSql(expected.sql))) throw new CmsError('MIGRATION_REQUIRED');
    }
    const duplicates=await planDuplicateLocales(database,slug);
    guards.push(duplicates.guard,...(duplicates.additionalGuards??[]));
    statements.push(...duplicates.statements,...standard);
    // Source055/074 always create replacement indexes before legacy drops.
    statements.push(...migrationObjects(legacy).filter(object=>actual.some(found=>found.name===object.name))
      .map(object=>sql`DROP INDEX ${sql.ref(object.name)}`.compile(database.db)));
  }
  return {guards,statements};
}

export const collectionStandardIndexesMigration:CmsMigrationProvider = {
  version:16,name:'collection-standard-indexes',prepare,
  async statements(database) { const plan=await prepare(database);return [...plan.guards,...plan.statements]; },
  async expectedObjects(database,installedVersion=0) {
    // Version0 has no static objects and never reads absent metadata.
    if (installedVersion<16) return [];
    const collections=await database.db.selectFrom('_cms_collections').select('slug').orderBy('slug').execute();
    return collections.flatMap(collection=>migrationObjects(collectionStandardIndexStatements(database,parse(identifier,collection.slug),installedVersion)));
  }
};
