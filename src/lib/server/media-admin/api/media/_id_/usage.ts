// Whole pinned GET body; Native imports/context only, same sole media read owner.
// EmDash1.1.0 913cb1bb; Copyright2026 Cloudflare Inc. MIT notices/emdash-MIT.txt.
import type {APIRoute} from '../../../../general-media/upstream/api/context.ts';
import {requirePerm} from '../../../../general-media/upstream/api/authorize.ts';
import {apiError,unwrapResult} from '../../../../general-media/upstream/api/error.ts';
import {handleMediaUsageDetails} from '../../../../general-media/upstream/api/handlers/media-usage-read.ts';
import {isParseError,parseQuery} from '../../../../general-media/upstream/api/parse.ts';
import {mediaUsageDetailsQuery} from '../../../../general-media/upstream/api/schemas/media-usage.ts';
import {requireScope} from '../../scopes.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;

	const mediaDenied = requirePerm(user, "media:read");
	if (mediaDenied) return mediaDenied;
	const contentDenied = requirePerm(user, "content:read_drafts");
	if (contentDenied) return contentDenied;
	const scopeDenied = requireScope(locals, "admin");
	if (scopeDenied) return scopeDenied;

	const { id } = params;
	if (!id) return apiError("INVALID_REQUEST", "Media ID required", 400);
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const query = parseQuery(new URL(request.url), mediaUsageDetailsQuery);
	if (isParseError(query)) return query;

	return unwrapResult(await handleMediaUsageDetails(emdash.db, id, query));
};
