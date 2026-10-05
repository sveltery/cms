// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
import type { BylineApiRoute as APIRoute } from "./api-context.ts";

import { requirePerm } from "./authorize.ts";
import { apiError, apiSuccess, handleError, unwrapResult } from "./http-errors.ts";
import { handleBylineCreate } from "./handlers.ts";
import { isParseError, parseBody, parseQuery } from "../menus/parse.ts";
import { bylineCreateBody, bylinesListQuery } from "./schemas.ts";
import { invalidateBylineCache } from "./index.ts";
import { BylineRepository } from "./repository.ts";

import { after } from "../menus/after.ts";
import { getI18nConfig, resolveConfiguredLocale } from "../menus/i18n-config.ts";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	const denied = requirePerm(user, "bylines:read");
	if (denied) return denied;

	const query = parseQuery(url, bylinesListQuery);
	if (isParseError(query)) return query;

	const locale = query.locale ? resolveConfiguredLocale(query.locale) : undefined;
	const i18n = getI18nConfig();
	if (locale && i18n && !i18n.locales.includes(locale)) {
		return apiError("VALIDATION_ERROR", `Locale "${locale}" is not configured for this site`, 400);
	}

	try {
		const repo = new BylineRepository(emdash.db);
		const result = await repo.findMany({
			search: query.search,
			isGuest: query.isGuest,
			userId: query.userId,
			locale,
			cursor: query.cursor,
			limit: query.limit,
		});

		return apiSuccess(result);
	} catch (error) {
		return handleError(error, "Failed to list bylines", "BYLINE_LIST_ERROR");
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	const denied = requirePerm(user, "bylines:manage");
	if (denied) return denied;

	const body = await parseBody(request, bylineCreateBody);
	if (isParseError(body)) return body;

	try {
		const result = await handleBylineCreate(emdash.db, {
			slug: body.slug,
			displayName: body.displayName,
			bio: body.bio ?? null,
			avatarMediaId: body.avatarMediaId ?? null,
			websiteUrl: body.websiteUrl ?? null,
			userId: body.userId,
			isGuest: body.isGuest,
			locale: body.locale,
			translationOf: body.translationOf,
			customFields: body.customFields,
		});

		if (result.success) {
			invalidateBylineCache();
			const byline = result.data;
			if (emdash.hooks) after(() => emdash.hooks!.runBylineAfterSave(byline, true));
		}
		return unwrapResult(result, 201);
	} catch (error) {
		return handleError(error, "Failed to create byline", "BYLINE_CREATE_ERROR");
	}
};
