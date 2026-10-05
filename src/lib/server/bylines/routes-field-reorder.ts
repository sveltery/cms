// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
/**
 * Byline field reorder.
 *
 * POST /_emdash/api/admin/byline-fields/reorder
 *
 * Body: `{ slugs: string[] }` — the exact set of currently registered
 * slugs in the desired order. The registry rejects any drift
 * (`REORDER_MISMATCH` → 400). Empty `[]` against an empty registered
 * set is a no-op by registry contract; the zod schema permits it.
 *
 * Thin wrapper around `handleBylineFieldReorder`.
 *
 * Phase 4 of Discussion #1174.
 */

import type { BylineApiRoute as APIRoute } from "./api-context.ts";

import { requirePerm } from "./authorize.ts";
import { requireDb, unwrapResult } from "./http-errors.ts";
import { handleBylineFieldReorder } from "./field-handlers.ts";
import { isParseError, parseBody } from "../menus/parse.ts";
import { bylineFieldReorderBody } from "./schemas.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "schema:manage");
	if (denied) return denied;

	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;

	const body = await parseBody(request, bylineFieldReorderBody);
	if (isParseError(body)) return body;

	const result = await handleBylineFieldReorder(emdash.db, body.slugs);
	return unwrapResult(result);
};
