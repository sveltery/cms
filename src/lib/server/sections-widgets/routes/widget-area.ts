// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/widget-areas/[name].ts
/**
 * Widget area by name endpoints
 *
 * GET    /_emdash/api/widget-areas/:name - Get area with widgets
 * DELETE /_emdash/api/widget-areas/:name - Delete area
 */

import type { APIRoute } from "../route-types.ts";

import { requirePerm } from "../api/authorize.ts";
import { apiError, apiSuccess, handleError } from "../api/error.ts";
import { widgetAreaTag } from "../chrome-tags.ts";
import { rowToWidget } from "../widgets/index.ts";
import type { WidgetRow } from "../widgets/types.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const db = emdash.db;
	const { name } = params;

	const denied = requirePerm(user, "widgets:read");
	if (denied) return denied;

	if (!name) {
		return apiError("VALIDATION_ERROR", "name is required", 400);
	}

	try {
		// Get the area
		const area = await db
			.selectFrom("_cms_widget_areas")
			.selectAll()
			.where("name", "=", name)
			.executeTakeFirst();

		if (!area) {
			return apiError("NOT_FOUND", `Widget area "${name}" not found`, 404);
		}

		// Get widgets for this area
		const widgets = await db
			.selectFrom("_cms_widgets")
			.selectAll()
			.$castTo<WidgetRow>()
			.where("area_id", "=", area.id)
			.orderBy("sort_order", "asc")
			.execute();

		return apiSuccess({
			...area,
			widgets: widgets.map((row) => rowToWidget(row)),
		});
	} catch (error) {
		return handleError(error, "Failed to fetch widget area", "WIDGET_AREA_GET_ERROR");
	}
};

export const DELETE: APIRoute = async ({ params, locals, cache }) => {
	const { emdash, user } = locals;
	const db = emdash.db;
	const { name } = params;

	const denied = requirePerm(user, "widgets:manage");
	if (denied) return denied;

	if (!name) {
		return apiError("VALIDATION_ERROR", "name is required", 400);
	}

	try {
		// Check if area exists
		const area = await db
			.selectFrom("_cms_widget_areas")
			.select("id")
			.where("name", "=", name)
			.executeTakeFirst();

		if (!area) {
			return apiError("NOT_FOUND", `Widget area "${name}" not found`, 404);
		}

		// Delete area (widgets cascade)
		await db.deleteFrom("_cms_widget_areas").where("id", "=", area.id).execute();

		if (cache?.enabled) await cache.invalidate({ tags: [widgetAreaTag(name)] });
		return apiSuccess({ deleted: true });
	} catch (error) {
		return handleError(error, "Failed to delete widget area", "WIDGET_AREA_DELETE_ERROR");
	}
};
