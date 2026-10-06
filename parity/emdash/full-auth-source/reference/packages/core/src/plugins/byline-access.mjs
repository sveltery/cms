import { sql } from "kysely";
import { resolveBylineCredits } from "../bylines/credits.js";
import { decodeCursor, encodeCursor, } from "../database/repositories/types.js";
import { validateIdentifier } from "../database/validate.js";
import { chunks, SQL_BATCH_SIZE } from "../utils/chunks.js";
const MAX_BYLINE_ENTRY_IDS = 100;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
export function toBylineInfo(byline) {
    return {
        id: byline.id,
        slug: byline.slug,
        displayName: byline.displayName,
        bio: byline.bio,
        websiteUrl: byline.websiteUrl,
        avatarMediaId: byline.avatarMediaId,
        locale: byline.locale,
        translationGroup: byline.translationGroup ?? byline.id,
    };
}
function toCreditInfo(credit) {
    return {
        byline: toBylineInfo(credit.byline),
        sortOrder: credit.sortOrder,
        roleLabel: credit.roleLabel,
        source: credit.source ?? "explicit",
    };
}
function clampListLimit(limit) {
    if (limit === undefined || !Number.isFinite(limit))
        return DEFAULT_LIST_LIMIT;
    return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}
function selectPublicBylines(db) {
    return db
        .selectFrom("_emdash_bylines")
        .select([
        "id",
        "slug",
        "display_name as displayName",
        "bio",
        "website_url as websiteUrl",
        "avatar_media_id as avatarMediaId",
        "locale",
        "translation_group as translationGroup",
        "created_at as createdAt",
    ]);
}
async function loadEntryRefs(db, collection, entryIds) {
    const tableName = `ec_${collection}`;
    const refs = [];
    for (const chunk of chunks(entryIds, SQL_BATCH_SIZE)) {
        const result = await sql `
			SELECT id, author_id, primary_byline_id, locale FROM ${sql.ref(tableName)}
			WHERE id IN (${sql.join(chunk)})
			AND deleted_at IS NULL
		`.execute(db);
        for (const row of result.rows) {
            refs.push({
                id: row.id,
                authorId: row.author_id,
                primaryBylineId: row.primary_byline_id,
                locale: row.locale,
            });
        }
    }
    return refs;
}
/**
 * Create read-only byline access (gated on `bylines:read`).
 */
export function createBylineAccess(db) {
    return {
        async get(id) {
            const row = await selectPublicBylines(db).where("id", "=", id).executeTakeFirst();
            return row ? toBylineInfo(row) : null;
        },
        async list(options) {
            const limit = clampListLimit(options?.limit);
            let query = selectPublicBylines(db)
                .orderBy("created_at", "desc")
                .orderBy("id", "desc")
                .limit(limit + 1);
            if (options?.locale !== undefined)
                query = query.where("locale", "=", options.locale);
            if (options?.cursor) {
                const decoded = decodeCursor(options.cursor);
                query = query.where((eb) => eb.or([
                    eb("created_at", "<", decoded.orderValue),
                    eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)]),
                ]));
            }
            const rows = await query.execute();
            const pageRows = rows.slice(0, limit);
            const last = pageRows.at(-1);
            return {
                items: pageRows.map(toBylineInfo),
                hasMore: rows.length > limit,
                ...(rows.length > limit && last ? { cursor: encodeCursor(last.createdAt, last.id) } : {}),
            };
        },
        async getEntriesBylines(collection, entryIds) {
            validateIdentifier(collection, "collection");
            const uniqueIds = [...new Set(entryIds)];
            if (uniqueIds.length > MAX_BYLINE_ENTRY_IDS) {
                throw new Error(`Byline lookups accept at most ${MAX_BYLINE_ENTRY_IDS} entry IDs`);
            }
            if (uniqueIds.length === 0)
                return [];
            const refs = await loadEntryRefs(db, collection, uniqueIds);
            const credits = await resolveBylineCredits(db, collection, refs, {
                hydrateCustomFields: false,
            });
            return uniqueIds.map((entryId) => ({
                entryId,
                bylines: (credits.get(entryId) ?? []).map(toCreditInfo),
            }));
        },
    };
}
