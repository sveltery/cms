// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/widget-areas/index.ts
/**
 * Widget areas list and create endpoints
 *
 * GET  /_emdash/api/widget-areas - List all widget areas
 * POST /_emdash/api/widget-areas - Create widget area
 */

import type { APIRoute } from "../route-types.ts";
import { ulid } from "ulidx";

import { requirePerm } from "../api/authorize.ts";
import { apiError, apiSuccess, handleError } from "../api/error.ts";
import { isParseError, parseBody } from "../api/parse.ts";
import { createWidgetAreaBody } from "../widgets/schemas.ts";
import { widgetAreaTag } from "../chrome-tags.ts";
import { rowToWidget } from "../widgets/index.ts";
import type { WidgetRow } from "../widgets/types.ts";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const { emdash, user } = locals;
	const db = emdash.db;

	const denied = requirePerm(user, "widgets:read");
	if (denied) return denied;

	try {
		const areas = await db
			.selectFrom("_cms_widget_areas")
			.selectAll()
			.orderBy("name", "asc")
			.execute();

		// Get widgets for each area (needed for drag-and-drop reordering in admin UI)
		const areasWithWidgets = await Promise.all(
			areas.map(async (area) => {
				const widgets = await db
					.selectFrom("_cms_widgets")
					.selectAll()
					.$castTo<WidgetRow>()
					.where("area_id", "=", area.id)
					.orderBy("sort_order", "asc")
					.execute();

				return {
					...area,
					widgets: widgets.map((row) => rowToWidget(row)),
					widgetCount: widgets.length,
				};
			}),
		);

		return apiSuccess({ items: areasWithWidgets });
	} catch (error) {
		return handleError(error, "Failed to fetch widget areas", "WIDGET_AREA_LIST_ERROR");
	}
};

export const POST: APIRoute = async ({ request, locals, cache }) => {
	const { emdash, user } = locals;
	const db = emdash.db;

	const denied = requirePerm(user, "widgets:manage");
	if (denied) return denied;

	try {
		const body = await parseBody(request, createWidgetAreaBody);
		if (isParseError(body)) return body;

		// Check if area name already exists
		const existing = await db
			.selectFrom("_cms_widget_areas")
			.select("id")
			.where("name", "=", body.name)
			.executeTakeFirst();

		if (existing) {
			return apiError("CONFLICT", `Widget area with name "${body.name}" already exists`, 409);
		}

		const id = ulid();
		await db
			.insertInto("_cms_widget_areas")
			.values({
				id,
				name: body.name,
				label: body.label,
				description: body.description ?? null,
			})
			.execute();

		const area = await db
			.selectFrom("_cms_widget_areas")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		if (cache?.enabled) await cache.invalidate({ tags: [widgetAreaTag(area.name)] });
		return apiSuccess(area, 201);
	} catch (error) {
		return handleError(error, "Failed to create widget area", "WIDGET_AREA_CREATE_ERROR");
	}
};
