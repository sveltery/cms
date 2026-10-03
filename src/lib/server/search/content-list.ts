// Complete pinned content.ts helper declarations; blob 34c2528c51a54119cd1730e876d699319c9f3702.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native module/import and system namespace substitutions only.
import type {Kysely} from 'kysely';
import type {Database} from '../database/lifecycle/upstream/database/types.ts';
import {isSqlite} from '../database/lifecycle/upstream/database/dialect-helpers.ts';
import {FTSManager} from './fts-manager.ts';
export async function resolveSearchColumns(db: Kysely<Database>, collection: string): Promise<string[]> {
	const row = await db
		.selectFrom("_cms_collections")
		.select(["id", "title_field"])
		.where("slug", "=", collection)
		.executeTakeFirst();
	if (!row) return ["slug"];

	const fields = await db
		.selectFrom("_cms_fields")
		.select(["slug", "searchable"])
		.where("collection_id", "=", row.id)
		.orderBy("sort_order", "asc")
		.execute();
	const columns = new Set(["slug"]);
	const fieldSlugs = new Set(fields.map((f) => f.slug));

	// A configured titleField takes precedence, then the conventional
	// title/name fields. A null title_field falls through to those defaults.
	if (row.title_field && fieldSlugs.has(row.title_field)) columns.add(row.title_field);
	for (const candidate of ["title", "name"]) {
		if (fieldSlugs.has(candidate)) columns.add(candidate);
	}
	for (const field of fields) {
		if (field.searchable === 1) columns.add(field.slug);
	}
	return [...columns];
}


export async function canUseFtsForListFilter(
	db: Kysely<Database>,
	collection: string,
	searchColumns: string[],
): Promise<boolean> {
	if (!isSqlite(db)) return false;
	const ftsManager = new FTSManager(db);
	const config = await ftsManager.getSearchConfig(collection);
	if (!config?.enabled) return false;
	const searchable = new Set(await ftsManager.getSearchableFields(collection));
	const covered = searchColumns.every((col) => col === "slug" || searchable.has(col));
	if (!covered) return false;
	return ftsManager.ftsTableExists(collection);
}


/** Shared real content-list boundary, matching the pinned handler's q branch. */
export async function contentListSearch(db:Kysely<Database>,collection:string,q:unknown) {
  if(typeof q !== 'string' || !q.trim()) return {};
  const searchColumns=await resolveSearchColumns(db,collection);
  return {q:q.trim(),searchColumns,useFts:await canUseFtsForListFilter(db,collection,searchColumns)};
}
