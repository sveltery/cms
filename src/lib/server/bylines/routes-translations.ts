// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
/**
 * Byline translation endpoints
 *
 * GET  /_emdash/api/admin/bylines/:id/translations  — list every translation
 *                                                     of a byline (siblings
 *                                                     in the same
 *                                                     translation_group)
 * POST /_emdash/api/admin/bylines/:id/translations  — create a new locale
 *                                                     variant joining the
 *                                                     source's
 *                                                     translation_group
 *                                                     (body: { locale, ... })
 */

import type { BylineApiRoute as APIRoute } from "./api-context.ts";

import { requirePerm } from "./authorize.ts";
import { apiError, handleError, requireDb, unwrapResult } from "./http-errors.ts";
import { handleBylineCreate, handleBylineTranslations } from "./handlers.ts";
import { isParseError, parseBody } from "../menus/parse.ts";
import { bylineTranslationCreateBody } from "./schemas.ts";
import { invalidateBylineCache } from "./index.ts";
import { BylineRepository } from "./repository.ts";

import { after } from "../menus/after.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const id = params.id!;

	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;

	const denied = requirePerm(user, "bylines:read");
	if (denied) return denied;

	try {
		const result = await handleBylineTranslations(emdash.db, id);
		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to fetch byline translations", "BYLINE_TRANSLATIONS_ERROR");
	}
};

export const POST: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;
	const id = params.id!;

	const dbErr = requireDb(emdash?.db);
	if (dbErr) return dbErr;

	const denied = requirePerm(user, "bylines:manage");
	if (denied) return denied;

	try {
		const body = await parseBody(request, bylineTranslationCreateBody);
		if (isParseError(body)) return body;

		// Look up the source byline so we can:
		//  (a) emit a clean 404 when it doesn't exist (route layer);
		//  (b) fall back to its slug + display_name + avatar/website when
		//      the body omits them. Editors creating a translation often
		//      want to keep the slug stable and only enter the localized
		//      bio/displayName — defaulting saves clicks.
		const repo = new BylineRepository(emdash.db);
		const source = await repo.findById(id);
		if (!source) {
			return apiError("NOT_FOUND", "Byline not found", 404);
		}

		const result = await handleBylineCreate(emdash.db, {
			slug: body.slug ?? source.slug,
			displayName: body.displayName ?? source.displayName,
			bio: body.bio ?? null,
			avatarMediaId: body.avatarMediaId ?? source.avatarMediaId,
			websiteUrl: body.websiteUrl ?? source.websiteUrl,
			isGuest: source.isGuest,
			locale: body.locale,
			translationOf: id,
		});

		if (result.success) {
			invalidateBylineCache();
			const byline = result.data;
			if (emdash.hooks) after(() => emdash.hooks!.runBylineAfterSave(byline, true));
		}
		return unwrapResult(result, 201);
	} catch (error) {
		return handleError(
			error,
			"Failed to create byline translation",
			"BYLINE_TRANSLATION_CREATE_ERROR",
		);
	}
};
