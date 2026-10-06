/**
 * Dashboard stats handler
 *
 * Returns summary data for the admin dashboard in a single request:
 * collection content counts, media count, user count, and recent
 * content across all collections.
 */
import { sql } from "kysely";
import { ContentRepository } from "../../database/repositories/content.js";
import { MediaRepository } from "../../database/repositories/media.js";
import { OptionsRepository } from "../../database/repositories/options.js";
import { UserRepository } from "../../database/repositories/user.js";
import { validateIdentifier } from "../../database/validate.js";
import { SCHEDULED_POLICY_REJECTION_PREFIX, isScheduledPolicyRejection, } from "../../plugins/content-policy.js";
import { getSchedulerHealth } from "../../scheduler-health.js";
const POLICY_REJECTION_PREVIEW_LIMIT = 20;
/**
 * Fetch dashboard statistics.
 *
 * Queries are intentionally lightweight — counts use indexed columns,
 * and recent items are capped at 10.
 */
export async function handleDashboardStats(db, now = new Date()) {
    try {
        // Discover collections from the system table
        const collections = await db
            .selectFrom("_emdash_collections")
            .select(["slug", "label"])
            .orderBy("slug", "asc")
            .execute();
        // Gather per-collection counts in parallel
        const contentRepo = new ContentRepository(db);
        const collectionStats = await Promise.all(collections.map(async (col) => {
            const stats = await contentRepo.getStats(col.slug, now);
            return {
                slug: col.slug,
                label: col.label,
                total: stats.total,
                published: stats.published,
                draft: stats.draft,
                scheduled: stats.scheduled,
                overdueScheduled: stats.overdueScheduled,
            };
        }));
        // Media and user counts
        const mediaRepo = new MediaRepository(db);
        const userRepo = new UserRepository(db);
        const optionsRepo = new OptionsRepository(db);
        const [mediaCount, userCount, schedulerHealth, policyRejectedScheduled, versionedPolicyRejectionOptions,] = await Promise.all([
            mediaRepo.count(),
            userRepo.count(),
            getSchedulerHealth(db, now),
            optionsRepo.countByPrefix(SCHEDULED_POLICY_REJECTION_PREFIX),
            optionsRepo.getVersionedByPrefix(SCHEDULED_POLICY_REJECTION_PREFIX, {
                limit: POLICY_REJECTION_PREVIEW_LIMIT,
            }),
        ]);
        const policyRejections = [...versionedPolicyRejectionOptions.values()]
            .filter(({ value }) => isScheduledPolicyRejection(value))
            .map(({ value, revision }) => ({ ...value, _rev: revision }));
        // Recent items across all collections (last 10 updated, any status)
        const recentItems = await fetchRecentItems(db, collections);
        return {
            success: true,
            data: {
                collections: collectionStats,
                mediaCount,
                userCount,
                recentItems,
                schedulerHealth,
                policyRejectedScheduled,
                policyRejections,
            },
        };
    }
    catch (error) {
        console.error("Dashboard stats error:", error);
        return {
            success: false,
            error: {
                code: "DASHBOARD_STATS_ERROR",
                message: "Failed to load dashboard statistics",
            },
        };
    }
}
/**
 * Fetch the 10 most recently updated items across all collections.
 *
 * Uses UNION ALL over each ec_* table. The query is safe because
 * collection slugs come from the system table and are validated.
 *
 * `title` is not a standard column — it's a user-defined field. We query
 * `_emdash_fields` to discover which collections have one and fall back
 * to `slug` (which is always present) otherwise.
 */
async function fetchRecentItems(db, collections) {
    if (collections.length === 0)
        return [];
    // Discover which collections have a "title" column
    const titleFields = await db
        .selectFrom("_emdash_fields as f")
        .innerJoin("_emdash_collections as c", "c.id", "f.collection_id")
        .select(["c.slug as collection_slug"])
        .where("f.slug", "=", "title")
        .execute();
    const collectionsWithTitle = new Set(titleFields.map((r) => r.collection_slug));
    // Issue one query per collection in parallel, then merge in JS.
    // A single UNION ALL across N collections trips D1's
    // SQLITE_LIMIT_COMPOUND_SELECT cap when N is large enough (#895);
    // per-collection queries side-step that. Each query fetches at most
    // 10 rows, so the merge handles at most N * 10 rows before slicing.
    const perCollection = await Promise.all(collections.map(async (col) => {
        validateIdentifier(col.slug);
        const table = `ec_${col.slug}`;
        const hasTitle = collectionsWithTitle.has(col.slug);
        // Use title column if it exists, otherwise fall back to slug, id.
        // All output uses snake_case to avoid SQLite quoting issues on D1.
        const titleExpr = hasTitle ? sql `COALESCE(title, slug, id)` : sql `COALESCE(slug, id)`;
        const result = await sql `
				SELECT
					id,
					${sql.lit(col.slug)} AS collection,
					${sql.lit(col.label)} AS collection_label,
					${titleExpr} AS title,
					slug,
					status,
					updated_at,
					author_id
				FROM ${sql.ref(table)}
				WHERE deleted_at IS NULL
				ORDER BY updated_at DESC
				LIMIT 10
			`.execute(db);
        return result.rows;
    }));
    // Merge across collections, sort by updated_at desc, take top 10.
    const merged = perCollection
        .flat()
        .toSorted((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
        .slice(0, 10);
    // Map snake_case DB rows to camelCase API shape
    return merged.map((row) => ({
        id: row.id,
        collection: row.collection,
        collectionLabel: row.collection_label,
        title: row.title,
        slug: row.slug,
        status: row.status,
        updatedAt: row.updated_at,
        authorId: row.author_id,
    }));
}
