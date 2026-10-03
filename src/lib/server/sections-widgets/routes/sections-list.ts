// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/sections/index.ts
/**
 * Sections list and create endpoints
 *
 * GET  /_emdash/api/sections - List all sections (with filters)
 * POST /_emdash/api/sections - Create section
 */

import type { APIRoute } from "../route-types.ts";

import { requirePerm } from "../api/authorize.ts";
import { handleError, requireDb, unwrapResult } from "../api/error.ts";
import { handleSectionCreate, handleSectionList } from "../sections/handlers.ts";
import { isParseError, parseBody, parseQuery } from "../api/parse.ts";
import { createSectionBody, sectionsListQuery } from "../sections/schemas.ts";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
	const { emdash, user } = locals;
	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;
	const db = emdash.db;

	const denied = requirePerm(user, "sections:read");
	if (denied) return denied;

	try {
		const query = parseQuery(url, sectionsListQuery);
		if (isParseError(query)) return query;

		const result = await handleSectionList(db, query);
		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to fetch sections", "SECTION_LIST_ERROR");
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;
	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;
	const db = emdash.db;

	const denied = requirePerm(user, "sections:manage");
	if (denied) return denied;

	try {
		const body = await parseBody(request, createSectionBody);
		if (isParseError(body)) return body;

		const result = await handleSectionCreate(db, body);
		return unwrapResult(result, 201);
	} catch (error) {
		return handleError(error, "Failed to create section", "SECTION_CREATE_ERROR");
	}
};
