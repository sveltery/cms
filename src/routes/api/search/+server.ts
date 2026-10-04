// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native request/permission hosting; Source route body and operation order retained.
/**
 * Search endpoint - Full-text search across collections
 *
 * GET /_emdash/api/search?q=query&collections=posts,pages&limit=20
 */

import type { RequestHandler } from "./$types";

import { apiError, apiSuccess, handleSearchError as handleError, searchContext, hasSearchPermission as hasPermission } from "../../../lib/server/search/http.ts";
import { isParseError, parseQuery } from "../../../lib/server/menus/parse.ts";
import { searchQuery } from "../../../lib/server/search/schemas.ts";
import { searchWithDb } from "../../../lib/server/search/query.ts";

export const prerender = false;

/**
 * Search content
 *
 * Query parameters:
 * - q: Search query (required)
 * - collections: Comma-separated list of collection slugs (optional, defaults to all)
 * - status: Filter by status (optional, defaults to 'published')
 * - limit: Maximum results (optional, defaults to 20)
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const emdash = searchContext(locals);
	const user = locals.cms?.principal ?? null;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "Search not configured", 500);
	}

	const query = parseQuery(url, searchQuery);
	if (isParseError(query)) return query;

	const collections = query.collections
		? query.collections.split(",").map((c: string) => c.trim())
		: undefined;

	// Only users with content:read_drafts may search non-published statuses.
	// Anonymous and subscriber requests are forced to "published".
	const status =
		query.status && query.status !== "published" && hasPermission(user, "content:read_drafts")
			? query.status
			: "published";

	try {
		// Verify FTS indexes are healthy on first use. At most once per worker
		// lifetime; no-op after that. Moved off the cold-start hot path to
		// keep anonymous public reads fast.
		await emdash.ensureSearchHealthy?.();

		const result = await searchWithDb(emdash.db, query.q, {
			collections,
			status,
			locale: query.locale,
			limit: query.limit,
			cursor: query.cursor,
			scope: query.scope,
		});

		return apiSuccess(result);
	} catch (error) {
		// handleError maps a malformed pagination cursor to a 400 INVALID_CURSOR.
		return handleError(error, "Search failed", "SEARCH_ERROR");
	}
};
