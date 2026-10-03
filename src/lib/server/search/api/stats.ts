// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 8e834cfa2bf2a207a94e04a36e034a11e2c0e45d.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host imports and APIRoute context type only; complete declaration bodies.
/**
 * Search stats endpoint
 *
 * GET /_emdash/api/search/stats
 */

import type { SourceSearchRoute as APIRoute } from "./support.ts";

import { requirePerm } from "./support.ts";
import { apiError, apiSuccess, handleError } from "./support.ts";
import { getSearchStats } from "./exports.ts";

export const prerender = false;

/**
 * Get search index statistics
 */
export const GET: APIRoute = async ({ locals }) => {
	const { emdash, user } = locals;

	const denied = requirePerm(user, "search:manage");
	if (denied) return denied;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
	}

	try {
		const stats = await getSearchStats(emdash.db);

		return apiSuccess(stats);
	} catch (error) {
		return handleError(error, "Failed to get stats", "STATS_ERROR");
	}
};
