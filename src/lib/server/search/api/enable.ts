// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob b58ba06c35354bd9d678b3cff5261dd5e75ac66c.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host imports and APIRoute context type only; complete declaration bodies.
/**
 * Search enable/disable endpoint
 *
 * POST /_emdash/api/search/enable
 */

import type { SourceSearchRoute as APIRoute } from "./support.ts";

import { requirePerm } from "./support.ts";
import { apiError, apiSuccess, handleError } from "./support.ts";
import { isParseError, parseBody } from "./parse.ts";
import { searchEnableBody } from "./schemas.ts";
import { FTSManager } from "./exports.ts";

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
export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
	}

	const denied = requirePerm(user, "search:manage");
	if (denied) return denied;

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
