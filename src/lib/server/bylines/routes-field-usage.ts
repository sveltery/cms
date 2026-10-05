// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
/**
 * Byline field usage counts.
 *
 * GET /_emdash/api/admin/byline-fields/{slug}/usage
 *
 * Returns `{ translatableValueCount, groupValueCount, totalAffectedRows }`.
 * Backs the destructive-delete confirm dialog in the admin UI (Phase 5).
 * Thin wrapper around `handleBylineFieldUsage`.
 *
 * Phase 4 of Discussion #1174.
 */

import type { BylineApiRoute as APIRoute } from "./api-context.ts";

import { requirePerm } from "./authorize.ts";
import { apiError, requireDb, unwrapResult } from "./http-errors.ts";
import { handleBylineFieldUsage } from "./field-handlers.ts";

export const prerender = false;

// GET requires `schema:read` (Editor+); see byline-fields/index.ts GET
// for rationale on the read/manage split.
export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "schema:read");
	if (denied) return denied;

	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;

	const slug = params.slug;
	if (!slug) return apiError("MISSING_PARAM", "Field slug is required", 400);

	const result = await handleBylineFieldUsage(emdash.db, slug);
	return unwrapResult(result);
};
