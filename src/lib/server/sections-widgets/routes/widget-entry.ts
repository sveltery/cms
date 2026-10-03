// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/widget-areas/[name]/widgets/[id].ts
/**
 * Single widget endpoints
 *
 * PUT    /_emdash/api/widget-areas/:name/widgets/:id - Update widget
 * DELETE /_emdash/api/widget-areas/:name/widgets/:id - Delete widget
 */

import type { APIRoute } from "../route-types.ts";

import { requirePerm } from "../api/authorize.ts";
import { apiError, apiSuccess, handleError } from "../api/error.ts";
import { isParseError, parseBody } from "../api/parse.ts";
import { updateWidgetBody } from "../widgets/schemas.ts";
import { widgetAreaTag } from "../chrome-tags.ts";
import { rowToWidget } from "../widgets/index.ts";
import type { WidgetRow } from "../widgets/types.ts";

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, locals, cache }) => {
	const { emdash, user } = locals;
	const db = emdash.db;
	const { name, id } = params;

	const denied = requirePerm(user, "widgets:manage");
	if (denied) return denied;

	if (!name || !id) {
		return apiError("VALIDATION_ERROR", "name and id are required", 400);
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

		// Check widget exists and belongs to this area
		const existingWidget = await db
			.selectFrom("_cms_widgets")
			.select("id")
			.where("id", "=", id)
			.where("area_id", "=", area.id)
			.executeTakeFirst();

		if (!existingWidget) {
			return apiError("NOT_FOUND", `Widget "${id}" not found in area "${name}"`, 404);
		}

		const body = await parseBody(request, updateWidgetBody);
		if (isParseError(body)) return body;

		// Build update object (only update provided fields)
		const updates: Record<string, unknown> = {};
		if (body.title !== undefined) updates.title = body.title || null;
		if (body.type !== undefined) updates.type = body.type;
		if (body.content !== undefined)
			updates.content = body.content ? JSON.stringify(body.content) : null;
		if (body.menuName !== undefined) updates.menu_name = body.menuName || null;
		if (body.componentId !== undefined) updates.component_id = body.componentId || null;
		if (body.componentProps !== undefined)
			updates.component_props = body.componentProps ? JSON.stringify(body.componentProps) : null;

		if (Object.keys(updates).length === 0) {
			return apiError("VALIDATION_ERROR", "No fields to update", 400);
		}

		await db.updateTable("_cms_widgets").set(updates).where("id", "=", id).execute();

		const widget = await db
			.selectFrom("_cms_widgets")
			.selectAll()
			.$castTo<WidgetRow>()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		if (cache?.enabled) await cache.invalidate({ tags: [widgetAreaTag(name)] });
		return apiSuccess(rowToWidget(widget));
	} catch (error) {
		return handleError(error, "Failed to update widget", "WIDGET_UPDATE_ERROR");
	}
};

export const DELETE: APIRoute = async ({ params, locals, cache }) => {
	const { emdash, user } = locals;
	const db = emdash.db;
	const { name, id } = params;

	const denied = requirePerm(user, "widgets:manage");
	if (denied) return denied;

	if (!name || !id) {
		return apiError("VALIDATION_ERROR", "name and id are required", 400);
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

		// Check widget exists and belongs to this area
		const existingWidget = await db
			.selectFrom("_cms_widgets")
			.select("id")
			.where("id", "=", id)
			.where("area_id", "=", area.id)
			.executeTakeFirst();

		if (!existingWidget) {
			return apiError("NOT_FOUND", `Widget "${id}" not found in area "${name}"`, 404);
		}

		await db.deleteFrom("_cms_widgets").where("id", "=", id).execute();

		if (cache?.enabled) await cache.invalidate({ tags: [widgetAreaTag(name)] });
		return apiSuccess({ deleted: true });
	} catch (error) {
		return handleError(error, "Failed to delete widget", "WIDGET_DELETE_ERROR");
	}
};
