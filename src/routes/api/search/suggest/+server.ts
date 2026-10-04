// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native request/permission hosting; Source route body and operation order retained.
/**
 * Search suggestions endpoint - Autocomplete
 *
 * GET /_emdash/api/search/suggest?q=hel&limit=5
 */

import type { RequestHandler } from "./$types";

import { apiError, apiSuccess, handleSearchError as handleError, searchContext } from "../../../../lib/server/search/http.ts";
import { isParseError, parseQuery } from "../../../../lib/server/menus/parse.ts";
import { searchSuggestQuery } from "../../../../lib/server/search/schemas.ts";
import { getSuggestions } from "../../../../lib/server/search/query.ts";

export const prerender = false;

/**
 * Get search suggestions for autocomplete
 *
 * Query parameters:
 * - q: Partial search query (required)
 * - collections: Comma-separated list of collection slugs (optional)
 * - limit: Maximum suggestions (optional, defaults to 5)
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const emdash = searchContext(locals);

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "Search not configured", 500);
	}

	const query = parseQuery(url, searchSuggestQuery);
	if (isParseError(query)) return query;

	const collections = query.collections
		? query.collections.split(",").map((c: string) => c.trim())
		: undefined;

	try {
		// Verify FTS indexes are healthy on first use. See search/index.ts.
		await emdash.ensureSearchHealthy?.();

		const suggestions = await getSuggestions(emdash.db, query.q, {
			collections,
			locale: query.locale,
			limit: query.limit,
		});

		return apiSuccess({ items: suggestions });
	} catch (error) {
		return handleError(error, "Failed to get suggestions", "SUGGESTION_ERROR");
	}
};
