// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source packages/core/src/astro/routes/api/media/folders/[id].ts; blob a0e230ec5dad37d14438c87e073683cb0079e95a.
import type { APIRoute } from "../../../../../../route-context.ts";

import { requirePerm } from "../../../../../api/authorize.ts";
import { apiError, unwrapResult } from "../../../../../api/error.ts";
import {
	handleMediaFolderDelete,
	handleMediaFolderGet,
	handleMediaFolderUpdate,
} from "../../../../../api/handlers/media-folders.ts";
import { isParseError, parseBody } from "../../../../../api/parse.ts";
import { mediaFolderBody, mediaFolderIdSchema } from "../../../../../api/schemas/media.ts";

export const prerender = false;

function parseFolderId(id: string | undefined): string | Response {
	const result = mediaFolderIdSchema.safeParse(id);
	return result.success
		? result.data
		: apiError("VALIDATION_ERROR", "Invalid media folder ID", 400);
}

export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "media:read");
	if (denied) return denied;
	if (!emdash) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const id = parseFolderId(params.id);
	if (id instanceof Response) return id;
	return unwrapResult(await handleMediaFolderGet(emdash.db, id));
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "media:edit_any");
	if (denied) return denied;
	if (!emdash) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const id = parseFolderId(params.id);
	if (id instanceof Response) return id;
	const body = await parseBody(request, mediaFolderBody);
	if (isParseError(body)) return body;
	return unwrapResult(await handleMediaFolderUpdate(emdash.db, id, body));
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "media:edit_any");
	if (denied) return denied;
	if (!emdash) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const id = parseFolderId(params.id);
	if (id instanceof Response) return id;
	return unwrapResult(await handleMediaFolderDelete(emdash.db, id));
};
