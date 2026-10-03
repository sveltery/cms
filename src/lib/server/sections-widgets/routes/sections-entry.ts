// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/sections/[slug].ts
/**
 * Section by slug endpoints
 *
 * GET    /_emdash/api/sections/:slug - Get section
 * PUT    /_emdash/api/sections/:slug - Update section
 * DELETE /_emdash/api/sections/:slug - Delete section
 */

import type { APIRoute } from "../route-types.ts";

import { requirePerm } from "../api/authorize.ts";
import { apiError, handleError, requireDb, unwrapResult } from "../api/error.ts";
import {
	handleSectionDelete,
	handleSectionGet,
	handleSectionUpdate,
} from "../sections/handlers.ts";
import { isParseError, parseBody } from "../api/parse.ts";
import { updateSectionBody } from "../sections/schemas.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;
	const db = emdash.db;
	const { slug } = params;

	const denied = requirePerm(user, "sections:read");
	if (denied) return denied;

	if (!slug) {
		return apiError("VALIDATION_ERROR", "slug is required", 400);
	}

	try {
		const result = await handleSectionGet(db, slug);
		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to fetch section", "SECTION_GET_ERROR");
	}
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;
	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;
	const db = emdash.db;
	const { slug } = params;

	const denied = requirePerm(user, "sections:manage");
	if (denied) return denied;

	if (!slug) {
		return apiError("VALIDATION_ERROR", "slug is required", 400);
	}

	try {
		const body = await parseBody(request, updateSectionBody);
		if (isParseError(body)) return body;

		const result = await handleSectionUpdate(db, slug, body);
		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to update section", "SECTION_UPDATE_ERROR");
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;
	const db = emdash.db;
	const { slug } = params;

	const denied = requirePerm(user, "sections:manage");
	if (denied) return denied;

	if (!slug) {
		return apiError("VALIDATION_ERROR", "slug is required", 400);
	}

	try {
		const result = await handleSectionDelete(db, slug);
		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to delete section", "SECTION_DELETE_ERROR");
	}
};
