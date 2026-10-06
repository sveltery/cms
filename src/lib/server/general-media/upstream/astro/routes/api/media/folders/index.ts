// EmDash immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
// Whole Source body; finite native imports and context typing; MED-API01.
import type { APIRoute } from "../../../../../api/context.ts";

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
