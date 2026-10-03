// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source packages/core/src/astro/routes/api/media/asset/[id]/[filename].ts; blob a99bf4c584c750ca725d74d2bb1d2dcb175c961d.
import type { APIRoute } from "../../../../../../../route-context.ts";

import { requirePerm } from "../../../../../../api/authorize.ts";
import { apiError, handleError } from "../../../../../../api/error.ts";
import { MediaRepository } from "../../../../../../database/repositories/media.ts";

export const prerender = false;

const SAFE_INLINE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/x-icon",
	"video/mp4",
	"video/webm",
	"audio/mpeg",
	"audio/wav",
	"audio/ogg",
]);

export const GET: APIRoute = async ({ params, locals }) => {
	const { id, filename } = params;
	const { emdash, user } = locals;
	const denied = requirePerm(user, "media:read");
	if (denied) return denied;
	if (!id || !filename) return apiError("NOT_FOUND", "File not found", 404);
	if (!emdash?.storage) return apiError("NOT_CONFIGURED", "Storage not configured", 500);

	try {
		const item = await new MediaRepository(emdash.db).findById(id);
		if (!item || item.status !== "ready" || item.filename !== filename) {
			return apiError("NOT_FOUND", "File not found", 404);
		}
		const result = await emdash.storage.download(item.storageKey);
		const headers: Record<string, string> = {
			"Content-Type": result.contentType,
			"Cache-Control": "private, max-age=0, must-revalidate",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy":
				"sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
			"Content-Disposition": SAFE_INLINE_TYPES.has(result.contentType) ? "inline" : "attachment",
		};
		if (result.size) headers["Content-Length"] = String(result.size);
		return new Response(result.body, { status: 200, headers });
	} catch (error) {
		return handleError(error, "Failed to serve file", "FILE_SERVE_ERROR");
	}
};
