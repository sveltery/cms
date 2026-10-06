import { sql } from "kysely";
/**
 * Migration: URL pattern for collections
 *
 * Adds `url_pattern` column to `_emdash_collections` so each collection
 * can declare its own URL structure (e.g. "/{slug}" for pages, "/blog/{slug}"
 * for posts). Used for menu URL resolution, sitemaps, and path-based lookups.
 */
export async function up(db) {
    await sql `
		ALTER TABLE _emdash_collections
		ADD COLUMN url_pattern TEXT
	`.execute(db);
}
export async function down(db) {
    await sql `
		ALTER TABLE _emdash_collections
		DROP COLUMN url_pattern
	`.execute(db);
}
