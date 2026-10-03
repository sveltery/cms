// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob dc198fd2f4923291d78ed9013a92b21b4b990fcf.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host imports and APIRoute context type only; complete declaration bodies.
/**
 * Search suggestions endpoint - Autocomplete
 *
 * GET /_emdash/api/search/suggest?q=hel&limit=5
 */

import type { SourceSearchRoute as APIRoute } from "./support.ts";

import { apiError, apiSuccess, handleError } from "./support.ts";
import { isParseError, parseQuery } from "./parse.ts";
import { searchSuggestQuery } from "./schemas.ts";
import { getSuggestions } from "./exports.ts";

export const prerender = false;

/**
 * Get search suggestions for autocomplete
 *
 * Query parameters:
 * - q: Partial search query (required)
 * - collections: Comma-separated list of collection slugs (optional)
 * - limit: Maximum suggestions (optional, defaults to 5)
 */
export const GET: APIRoute = async ({ url, locals }) => {
	const { emdash } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
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
