// Pinned taxonomy visible-count seek index, from core/src/schema/registry.ts
// and migration041_content_locale_list_index.ts; MIT Cloudflare Inc. 2026.
import {sql,type CompiledQuery} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {identifier,parse} from '../database/validation.ts';
import {ulid} from 'ulidx';
export function taxonomyCollectionIndex(database:CmsDatabase,slug:string):CompiledQuery {
 const valid=parse(identifier,slug),table=`ec_${valid}`;
 return sql`CREATE INDEX ${sql.ref(`idx_${table}_del_tg_locale`)} ON ${sql.ref(table)}(deleted_at,translation_group,locale)`.compile(database.db);
}
export async function newCollectionTaxonomyIndexes(database:CmsDatabase,slug:string):Promise<CompiledQuery[]> {
 const installed=(await sql<{version:number}>`SELECT version FROM _cms_migrations WHERE version=7`.execute(database.db)).rows.length>0;
 return installed?[taxonomyCollectionIndex(database,slug)]:[];
}
export async function registeredTaxonomyIndexes(database:CmsDatabase):Promise<CompiledQuery[]> {
 const exists=(await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='_cms_collections'`.execute(database.db)).rows.length>0;
 if(!exists)return[];
 const rows=(await sql<{slug:string}>`SELECT slug FROM _cms_collections ORDER BY slug`.execute(database.db)).rows;
 return rows.map(row=>taxonomyCollectionIndex(database,row.slug));
}
/** Bind the v7 index plan to the same registered collection and DDL snapshot. */
export async function guardedTaxonomyIndexPlan(database:CmsDatabase):Promise<{before:CompiledQuery[];indexes:CompiledQuery[];after:CompiledQuery[]}> {
 const db=database.db;
 const exists=(await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='_cms_collections'`.execute(db)).rows.length>0;
 const metadata=sql<{snapshot:string}>`SELECT json_group_array(json_array(id,slug,version)) AS snapshot FROM (SELECT id,slug,version FROM _cms_collections ORDER BY id)`;
 const ddl=sql<{snapshot:string}>`SELECT json_group_array(json_array(name,type,sql)) AS snapshot FROM (SELECT name,type,sql FROM sqlite_master WHERE (name GLOB 'ec_*' OR name GLOB 'idx_ec_*') AND type IN ('table','index') ORDER BY name)`;
 const expectedMetadata=exists?(await metadata.execute(db)).rows[0].snapshot:'[]';
 const installed=exists?(await sql<{version:number}>`SELECT coalesce(max(version),0) AS version FROM _cms_migrations`.execute(db)).rows[0].version:0;
 // The v5 provider owns its earlier table rebuild and prerequisite DDL guard.
 // At v5+ those tables no longer change in providers preceding v7.
 const expectedDdl=installed>=5?(await ddl.execute(db)).rows[0].snapshot:undefined;
 const rows=exists?(await sql<{slug:string}>`SELECT slug FROM _cms_collections ORDER BY slug`.execute(db)).rows:[];
 const token=ulid();
 return {
  before:[sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN (${metadata})=${expectedMetadata} ${expectedDdl===undefined?sql``:sql`AND (${ddl})=${expectedDdl}`} THEN 1 ELSE 0 END`.compile(db)],
  indexes:rows.map(row=>taxonomyCollectionIndex(database,row.slug)),
  after:[sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(db)]
 };
}
