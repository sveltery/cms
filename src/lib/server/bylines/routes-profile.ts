// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
import type { BylineApiRoute as APIRoute } from "./api-context.ts";

import { requirePerm } from "./authorize.ts";
import { apiError, apiSuccess, handleError, requireDb, unwrapResult } from "./http-errors.ts";
import { handleBylineUpdate } from "./handlers.ts";
import { isParseError, parseBody } from "../menus/parse.ts";
import { bylineUpdateBody } from "./schemas.ts";
import { invalidateBylineCache } from "./index.ts";
import { BylineRepository } from "./repository.ts";

import { after } from "../menus/after.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "bylines:read");
	if (denied) return denied;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const repo = new BylineRepository(emdash.db);
		const byline = await repo.findById(params.id!);
		if (!byline) return apiError("NOT_FOUND", "Byline not found", 404);
		return apiSuccess(byline);
	} catch (error) {
		return handleError(error, "Failed to get byline", "BYLINE_GET_ERROR");
	}
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "bylines:manage");
	if (denied) return denied;

	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;

	const body = await parseBody(request, bylineUpdateBody);
	if (isParseError(body)) return body;

	const result = await handleBylineUpdate(emdash.db, params.id!, {
		slug: body.slug,
		displayName: body.displayName,
		bio: body.bio ?? null,
		avatarMediaId: body.avatarMediaId ?? null,
		websiteUrl: body.websiteUrl ?? null,
		userId: body.userId ?? null,
		isGuest: body.isGuest,
		// Forward `customFields` only when present so the repo treats an
		// omitted key as "leave existing values untouched". An empty
		// object also no-ops by repo convention — see
		// `BylineRepository.update`. Validation (unknown slug, type
		// mismatch, select-choice) happens inside the repo and surfaces
		// as `EmDashValidationError`, which the handler maps to a 400
		// `VALIDATION_ERROR` for `unwrapResult` / `mapErrorStatus`.
		customFields: body.customFields,
	});

	if (result.success) {
		invalidateBylineCache();
		const byline = result.data;
		if (emdash.hooks) after(() => emdash.hooks!.runBylineAfterSave(byline, false));
	}
	return unwrapResult(result);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "bylines:manage");
	if (denied) return denied;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const repo = new BylineRepository(emdash.db);
		const existing = emdash.hooks?.hasHooks("byline:afterDelete")
			? await repo.findById(params.id!)
			: null;
		const deleted = await repo.delete(params.id!);
		if (!deleted) return apiError("NOT_FOUND", "Byline not found", 404);
		invalidateBylineCache();
		if (existing) after(() => emdash.hooks!.runBylineAfterDelete(existing));
		return apiSuccess({ deleted: true });
	} catch (error) {
		return handleError(error, "Failed to delete byline", "BYLINE_DELETE_ERROR");
	}
};
