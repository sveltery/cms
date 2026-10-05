// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
/**
 * Byline custom-field schema management — list + create.
 *
 * - GET  /_emdash/api/admin/byline-fields           list every registered field
 * - POST /_emdash/api/admin/byline-fields           create a new field definition
 *
 * Thin wrappers around `handleBylineFieldList` / `handleBylineFieldCreate`
 * in `api/handlers/byline-fields.ts`. Both endpoints require
 * `schema:manage`. Reserved-slug + identifier validation runs at the
 * zod layer in `bylineFieldCreateBody`; the registry repeats the check
 * for defence-in-depth. Domain errors surface as typed `ErrorCode`s and
 * are mapped to HTTP statuses by `unwrapResult` → `mapErrorStatus`.
 *
 * Phase 4 of Discussion #1174.
 */

import type { BylineApiRoute as APIRoute } from "./api-context.ts";

import { requirePerm } from "./authorize.ts";
import { requireDb, unwrapResult } from "./http-errors.ts";
import { handleBylineFieldCreate, handleBylineFieldList } from "./field-handlers.ts";
import { isParseError, parseBody } from "../menus/parse.ts";
import { bylineFieldCreateBody } from "./schemas.ts";

export const prerender = false;

// GET requires `schema:read` (Editor+), not `schema:manage` — Phase 6
// of #1174 surfaced the split: editors need to read field definitions
// to render custom-field inputs in the byline edit form, while only
// admins manage the registry. The Phase 4 review-round constraint
// "every endpoint returns 403 for a user without schema:manage" is
// superseded for the read endpoints; mutations remain admin-only.
export const GET: APIRoute = async ({ locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "schema:read");
	if (denied) return denied;

	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;

	const result = await handleBylineFieldList(emdash.db);
	return unwrapResult(result);
};

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "schema:manage");
	if (denied) return denied;

	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;

	const body = await parseBody(request, bylineFieldCreateBody);
	if (isParseError(body)) return body;

	const result = await handleBylineFieldCreate(emdash.db, {
		slug: body.slug,
		label: body.label,
		type: body.type,
		required: body.required,
		translatable: body.translatable,
		validation: body.validation ?? null,
		sortOrder: body.sortOrder,
	});
	return unwrapResult(result, 201);
};
