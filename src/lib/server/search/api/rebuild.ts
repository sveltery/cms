// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 1b05389eb81cd52d308c18ee5f3bf44f63ff8384.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host imports and APIRoute context type only; complete declaration bodies.
/**
 * Search rebuild endpoint - Rebuild FTS index
 *
 * POST /_emdash/api/search/rebuild
 */

import type { SourceSearchRoute as APIRoute } from "./support.ts";

import { requirePerm } from "./support.ts";
import { apiError, apiSuccess, handleError } from "./support.ts";
import { isParseError, parseBody } from "./parse.ts";
import { searchRebuildBody } from "./schemas.ts";
import { FTSManager } from "./exports.ts";

export const prerender = false;

/**
 * Rebuild the search index for a collection
 *
 * Body:
 * - collection: Collection slug to rebuild (required)
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
	}

	const denied = requirePerm(user, "search:manage");
	if (denied) return denied;

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
