// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source packages/core/src/astro/routes/api/media/folders/index.ts; blob ef1e496910b5bfcf42f9c399a34aac13b0f8a769.
import type { APIRoute } from "../../../../../../route-context.ts";

import { requirePerm } from "../../../../../api/authorize.ts";
import { apiError, unwrapResult } from "../../../../../api/error.ts";
import { handleMediaFolderCreate, handleMediaFolderList } from "../../../../../api/handlers/media-folders.ts";
import { isParseError, parseBody, parseQuery } from "../../../../../api/parse.ts";
import { mediaFolderBody, mediaFolderListQuery } from "../../../../../api/schemas/media.ts";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "media:read");
	if (denied) return denied;
	if (!emdash) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const query = parseQuery(new URL(request.url), mediaFolderListQuery);
	if (isParseError(query)) return query;
	return unwrapResult(
		await handleMediaFolderList(emdash.db, {
			limit: query.limit,
			cursor: query.cursor,
			q: query.q,
		}),
	);
};

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "media:edit_any");
	if (denied) return denied;
	if (!emdash) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const body = await parseBody(request, mediaFolderBody);
	if (isParseError(body)) return body;
	return unwrapResult(await handleMediaFolderCreate(emdash.db, body), 201);
};
