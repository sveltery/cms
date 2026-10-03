// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source packages/core/src/astro/routes/api/media/[id].ts; blob 10eb11226766fb429015ce2709c3d897449d83af.
/**
 * Single media item endpoint
 *
 * GET /_emdash/api/media/:id - Get media item
 * PUT /_emdash/api/media/:id - Update media metadata
 * DELETE /_emdash/api/media/:id - Delete media item
 */

import type { APIRoute } from "../../../../../route-context.ts";

import { canReadMediaUsageCount, requireOwnerPerm, requirePerm } from "../../../../api/authorize.ts";
import { apiError, apiSuccess, handleError, unwrapResult } from "../../../../api/error.ts";
import { handleMediaUsageSummaries } from "../../../../../usage-boundary.ts";
import { isParseError, parseBody, parseQuery } from "../../../../api/parse.ts";
import { mediaGetQuery, mediaUpdateBody } from "../../../../api/schemas/media.ts";
export const prerender = false;

/**
 * Get media item
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;
	const { id } = params;

	const readDenied = requirePerm(user, "media:read");
	if (readDenied) return readDenied;

	if (!id) {
		return apiError("INVALID_REQUEST", "Media ID required", 400);
	}

	if (!emdash?.handleMediaGet) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}
	const query = parseQuery(new URL(request.url), mediaGetQuery);
	if (isParseError(query)) return query;

	const result = await emdash.handleMediaGet(id);
	if (!result.success || query.includeUsage !== "1") return unwrapResult(result);

	const includeCount = canReadMediaUsageCount(user, locals.tokenScopes);
	const usageResult = await handleMediaUsageSummaries(emdash.db, [id], { includeCount });
	if (!usageResult.success) return unwrapResult(usageResult);
	const usage = usageResult.data[id];
	if (!usage) return apiError("MEDIA_USAGE_READ_ERROR", "Failed to read media usage", 500);

	return apiSuccess({ item: { ...result.data.item, usage } });
};

/**
 * Update media metadata
 *
 * Authors can edit their own media; editors+ can edit any.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;
	const { id } = params;

	// Minimum permission gate — ownership checked below
	const editDenied = requirePerm(user, "media:edit_own");
	if (editDenied) return editDenied;

	if (!id) {
		return apiError("INVALID_REQUEST", "Media ID required", 400);
	}

	if (!emdash?.handleMediaGet || !emdash?.handleMediaUpdate) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		// Fetch media item for ownership check
		const getResult = await emdash.handleMediaGet(id);
		if (!getResult.success || !getResult.data?.item) {
			return apiError("NOT_FOUND", "Media item not found", 404);
		}

		const media = getResult.data.item;

		// Ownership check: authors can edit own, editors+ can edit any
		const ownerDenied = requireOwnerPerm(user, media.authorId, "media:edit_own", "media:edit_any");
		if (ownerDenied) return ownerDenied;

		const body = await parseBody(request, mediaUpdateBody);
		if (isParseError(body)) return body;

		const result = await emdash.handleMediaUpdate(id, {
			alt: body.alt,
			caption: body.caption,
			width: body.width,
			height: body.height,
			folderId: body.folderId,
			focalX: body.focalX,
			focalY: body.focalY,
		});

		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to update media", "MEDIA_UPDATE_ERROR");
	}
};

/**
 * Delete media item
 *
 * Authors can delete their own media; editors+ can delete any.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const { id } = params;

	// Minimum permission gate — ownership checked below
	const deleteDenied = requirePerm(user, "media:delete_own");
	if (deleteDenied) return deleteDenied;

	if (!id) {
		return apiError("INVALID_REQUEST", "Media ID required", 400);
	}

	if (!emdash?.handleMediaGet || !emdash?.handleMediaDelete) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		// Fetch media item for ownership check and storage key
		const getResult = await emdash.handleMediaGet(id);
		if (!getResult.success || !getResult.data?.item) {
			return apiError("NOT_FOUND", "Media item not found", 404);
		}

		const media = getResult.data.item;

		// Ownership check: authors can delete own, editors+ can delete any
		const ownerDenied = requireOwnerPerm(
			user,
			media.authorId,
			"media:delete_own",
			"media:delete_any",
		);
		if (ownerDenied) return ownerDenied;

		// Storage deletion and site-settings cache invalidation happen in
		// `EmDashRuntime.handleMediaDelete` so the MCP tool inherits them.
		const result = await emdash.handleMediaDelete(id);
		if (!result.success) return unwrapResult(result);
		if (
			typeof result.data !== "object" ||
			result.data === null ||
			!("storageDeleted" in result.data) ||
			typeof result.data.storageDeleted !== "boolean"
		) {
			return apiError("MEDIA_DELETE_ERROR", "Failed to delete media", 500);
		}

		return apiSuccess({ deleted: true, storageDeleted: result.data.storageDeleted });
	} catch (error) {
		return handleError(error, "Failed to delete media", "MEDIA_DELETE_ERROR");
	}
};
