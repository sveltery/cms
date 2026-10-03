// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/widget-areas/[name]/reorder.ts
/**
 * Reorder widgets endpoint
 *
 * POST /_emdash/api/widget-areas/:name/reorder
 */

import type { APIRoute } from "../route-types.ts";

import { requirePerm } from "../api/authorize.ts";
import { apiError, apiSuccess, handleError } from "../api/error.ts";
import { isParseError, parseBody } from "../api/parse.ts";
import { reorderWidgetsBody } from "../widgets/schemas.ts";
import { widgetAreaTag } from "../chrome-tags.ts";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, cache }) => {
	const { emdash, user } = locals;
	const db = emdash.db;
	const { name } = params;

	const denied = requirePerm(user, "widgets:manage");
	if (denied) return denied;

	if (!name) {
		return apiError("VALIDATION_ERROR", "name is required", 400);
	}

	try {
		// Get the area
		const area = await db
			.selectFrom("_cms_widget_areas")
			.select("id")
			.where("name", "=", name)
			.executeTakeFirst();

		if (!area) {
			return apiError("NOT_FOUND", `Widget area "${name}" not found`, 404);
		}

		const body = await parseBody(request, reorderWidgetsBody);
		if (isParseError(body)) return body;

		// Verify all widget IDs belong to this area
		const existingWidgets = await db
			.selectFrom("_cms_widgets")
			.select("id")
			.where("area_id", "=", area.id)
			.execute();

		const existingIds = new Set(existingWidgets.map((w) => w.id));
		for (const id of body.widgetIds) {
			if (!existingIds.has(id)) {
				return apiError("VALIDATION_ERROR", `Widget "${id}" not found in area "${name}"`, 400);
			}
		}

		// Update sort_order for each widget
		await Promise.all(
			body.widgetIds.map((id, index) =>
				db.updateTable("_cms_widgets").set({ sort_order: index }).where("id", "=", id).execute(),
			),
		);

		if (cache?.enabled) await cache.invalidate({ tags: [widgetAreaTag(name)] });
		return apiSuccess({ success: true });
	} catch (error) {
		return handleError(error, "Failed to reorder widgets", "WIDGET_REORDER_ERROR");
	}
};
