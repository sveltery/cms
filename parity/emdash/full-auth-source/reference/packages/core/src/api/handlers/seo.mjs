/**
 * SEO Handlers
 *
 * Business logic for sitemap generation and robots.txt.
 */
import { sql } from "kysely";
import { validateIdentifier } from "../../database/validate.js";
/** Maximum entries per sitemap (per spec) */
const SITEMAP_MAX_ENTRIES = 50_000;
/** Matches a trailing timezone designator (`Z` or `±HH`, `±HHMM`, `±HH:MM`). */
const TZ_SUFFIX_RE = /([zZ]|[+-]\d{2}(:?\d{2})?)$/;
/**
 * Normalize a stored timestamp to W3C Datetime (ISO 8601) for sitemaps.
 *
 * `updated_at` is not guaranteed to be ISO: the column default is
 * `datetime('now')` on SQLite and `CURRENT_TIMESTAMP` on Postgres, both of
 * which store a space-separated `YYYY-MM-DD HH:MM:SS` string (and imported
 * content can carry other shapes). The sitemap `<lastmod>` field requires
 * W3C Datetime, and Google Search Console rejects the space-separated form
 * as "Invalid date". Normalize defensively, assuming UTC when no offset is
 * present (matches SQLite's `datetime('now')`). Valid date strings are
 * normalized to UTC ISO 8601; unparseable values are returned as-is.
 */
function toW3CDate(value) {
    if (!value)
        return value;
    let normalized = value.trim();
    if (normalized.includes(" ") && !normalized.includes("T")) {
        normalized = normalized.replace(" ", "T");
    }
    if (!TZ_SUFFIX_RE.test(normalized)) {
        normalized += "Z";
    }
    const parsed = Date.parse(normalized);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}
/**
 * Collect all published, indexable content across SEO-enabled collections
 * for sitemap generation, grouped by collection.
 *
 * Only includes content from routable collections with `has_seo = 1`.
 * Excludes content with `seo_no_index = 1` in the `_emdash_seo` table.
 *
 * Returns raw data grouped per collection. The caller (route) is
 * responsible for building absolute URLs — this handler does NOT
 * assume a URL structure.
 */
export async function handleSitemapData(db, 
/** When set, only return data for this collection. */
collectionSlug) {
    try {
        // Find SEO-enabled collections (optionally filtered)
        let query = db
            .selectFrom("_emdash_collections")
            .select(["slug", "url_pattern"])
            .where("has_seo", "=", 1)
            .where("routable", "=", 1);
        if (collectionSlug) {
            query = query.where("slug", "=", collectionSlug);
        }
        const collections = await query.execute();
        const result = [];
        for (const col of collections) {
            // Validate the slug before using it as a table name identifier.
            // Should always pass (slugs are validated on creation), but
            // guards against corrupted DB data.
            try {
                validateIdentifier(col.slug, "collection slug");
            }
            catch {
                console.warn(`[SITEMAP] Skipping collection with invalid slug: ${col.slug}`);
                continue;
            }
            const tableName = `ec_${col.slug}`;
            // Query published, non-deleted content.
            // LEFT JOIN _emdash_seo to check noindex flag.
            // Content without an SEO row is assumed indexable (default).
            // Wrapped in try/catch so a missing/broken table doesn't fail the
            // entire sitemap — we skip that collection and continue.
            try {
                const rows = await sql `
					SELECT c.slug, c.id, c.updated_at, c.published_at, c.locale, c.translation_group, s.seo_image
					FROM ${sql.ref(tableName)} c
					LEFT JOIN _emdash_seo s
						ON s.collection = ${col.slug}
						AND s.content_id = c.id
					WHERE c.status = 'published'
					AND c.deleted_at IS NULL
					AND c.slug IS NOT NULL
					AND TRIM(c.slug) <> ''
					AND (s.seo_no_index IS NULL OR s.seo_no_index = 0)
					ORDER BY c.updated_at DESC
					LIMIT ${SITEMAP_MAX_ENTRIES}
				`.execute(db);
                if (rows.rows.length === 0)
                    continue;
                const entries = [];
                for (const row of rows.rows) {
                    entries.push({
                        id: row.id,
                        slug: row.slug,
                        updatedAt: toW3CDate(row.updated_at),
                        publishedAt: row.published_at ?? null,
                        locale: row.locale,
                        translationGroup: row.translation_group,
                        image: row.seo_image ?? null,
                    });
                }
                result.push({
                    collection: col.slug,
                    urlPattern: col.url_pattern,
                    // Rows are ordered by updated_at DESC, so first row is the latest
                    lastmod: toW3CDate(rows.rows[0].updated_at),
                    entries,
                });
            }
            catch (err) {
                // Table missing or query error — skip this collection
                console.warn(`[SITEMAP] Failed to query collection "${col.slug}":`, err);
                continue;
            }
        }
        return { success: true, data: { collections: result } };
    }
    catch (error) {
        console.error("[SITEMAP_ERROR]", error);
        return {
            success: false,
            error: { code: "SITEMAP_ERROR", message: "Failed to generate sitemap data" },
        };
    }
}
