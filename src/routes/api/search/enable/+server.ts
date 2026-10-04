// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native request/permission hosting; Source route body and operation order retained.
/**
 * Search enable/disable endpoint
 *
 * POST /_emdash/api/search/enable
 */

import type { RequestHandler } from "./$types";

import { apiError, apiSuccess, handleSearchError as handleError, searchContext, requireSearchManagement, requireSearchMutation } from "../../../../lib/server/search/http.ts";
import { isParseError, parseBody } from "../../../../lib/server/menus/parse.ts";
import { searchEnableBody } from "../../../../lib/server/search/schemas.ts";
import { FTSManager } from "../../../../lib/server/content-picker/fts-manager.ts";

export const prerender = false;

/**
 * Enable or disable search for a collection
 *
 * Body:
 * - collection: Collection slug (required)
 * - enabled: boolean (required)
 * - weights: Optional field weights for ranking
 * - tokenize: Optional FTS5 tokenizer configuration
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const emdash = searchContext(locals);
	const user = locals.cms?.principal ?? null;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "Search not configured", 500);
	}

	const denied = requireSearchManagement(user);
	if (denied) return denied;
	const mutationDenied = requireSearchMutation(request, locals);
	if (mutationDenied) return mutationDenied;

	const body = await parseBody(request, searchEnableBody);
	if (isParseError(body)) return body;

	const ftsManager = new FTSManager(emdash.db);

	try {
		if (body.enabled) {
			// Enable search - creates FTS table, triggers, and populates index
			await ftsManager.enableSearch(body.collection, {
				weights: body.weights,
				tokenize: body.tokenize,
			});

			const stats = await ftsManager.getIndexStats(body.collection);

			return apiSuccess({
				collection: body.collection,
				enabled: true,
				indexed: stats?.indexed ?? 0,
			});
		} else {
			// Disable search - drops FTS table and triggers
			await ftsManager.disableSearch(body.collection);

			return apiSuccess({
				collection: body.collection,
				enabled: false,
			});
		}
	} catch (error) {
		return handleError(error, "Failed to update search config", "SEARCH_ERROR");
	}
};
