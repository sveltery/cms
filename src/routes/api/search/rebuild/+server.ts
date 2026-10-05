// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native request/permission hosting; Source route body and operation order retained.
/**
 * Search rebuild endpoint - Rebuild FTS index
 *
 * POST /_emdash/api/search/rebuild
 */

import type { RequestHandler } from "./$types";

import { apiError, apiSuccess, handleSearchError as handleError, searchContext, requireSearchManagement, requireSearchMutation } from "../../../../lib/server/search/http.ts";
import { isParseError, parseBody } from "../../../../lib/server/menus/parse.ts";
import { searchRebuildBody } from "../../../../lib/server/search/schemas.ts";
import { FTSManager } from "../../../../lib/server/content-picker/fts-manager.ts";

export const prerender = false;

/**
 * Rebuild the search index for a collection
 *
 * Body:
 * - collection: Collection slug to rebuild (required)
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

	const body = await parseBody(request, searchRebuildBody);
	if (isParseError(body)) return body;

	const ftsManager = new FTSManager(emdash.db);

	try {
		// Get search config for the collection
		const config = await ftsManager.getSearchConfig(body.collection);
		if (!config?.enabled) {
			return apiError(
				"SEARCH_NOT_ENABLED",
				`Search is not enabled for collection "${body.collection}"`,
				400,
			);
		}

		// Get searchable fields
		const searchableFields = await ftsManager.getSearchableFields(body.collection);
		if (searchableFields.length === 0) {
			return apiError(
				"NO_SEARCHABLE_FIELDS",
				`No searchable fields defined for collection "${body.collection}"`,
				400,
			);
		}

		// Rebuild the index
		await ftsManager.rebuildIndex(
			body.collection,
			searchableFields,
			config.weights,
			config.tokenize,
		);

		// Get stats after rebuild
		const stats = await ftsManager.getIndexStats(body.collection);

		return apiSuccess({
			collection: body.collection,
			indexed: stats?.indexed ?? 0,
		});
	} catch (error) {
		return handleError(error, "Failed to rebuild index", "REBUILD_ERROR");
	}
};
