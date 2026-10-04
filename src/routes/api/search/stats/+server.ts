// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native request/permission hosting; Source route body and operation order retained.
/**
 * Search stats endpoint
 *
 * GET /_emdash/api/search/stats
 */

import type { RequestHandler } from "./$types";

import { apiError, apiSuccess, handleSearchError as handleError, searchContext, requireSearchManagement } from "../../../../lib/server/search/http.ts";
import { getSearchStats } from "../../../../lib/server/search/query.ts";

export const prerender = false;

/**
 * Get search index statistics
 */
export const GET: RequestHandler = async ({ locals }) => {
	const emdash = searchContext(locals);
	const user = locals.cms?.principal ?? null;

	const denied = requireSearchManagement(user);
	if (denied) return denied;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "Search not configured", 500);
	}

	try {
		const stats = await getSearchStats(emdash.db);

		return apiSuccess(stats);
	} catch (error) {
		return handleError(error, "Failed to get stats", "STATS_ERROR");
	}
};
