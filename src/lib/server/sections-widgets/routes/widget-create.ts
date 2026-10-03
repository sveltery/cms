// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/widget-areas/[name]/widgets.ts
/**
 * Widgets CRUD endpoints
 *
 * POST /_emdash/api/widget-areas/:name/widgets - Add widget
 */

import type { APIRoute } from "../route-types.ts";
import { ulid } from "ulidx";

import { requirePerm } from "../api/authorize.ts";
import { apiError, apiSuccess, handleError } from "../api/error.ts";
import { isParseError, parseBody } from "../api/parse.ts";
import { createWidgetBody } from "../widgets/schemas.ts";
import { widgetAreaTag } from "../chrome-tags.ts";
import { rowToWidget } from "../widgets/index.ts";
import type { WidgetRow } from "../widgets/types.ts";

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

		const body = await parseBody(request, createWidgetBody);
		if (isParseError(body)) return body;

		// Get max sort_order
		const maxOrder = await db
			.selectFrom("_cms_widgets")
			.select(({ fn }) => fn.max("sort_order").as("maxOrder"))
			.where("area_id", "=", area.id)
			.executeTakeFirst();

		const sortOrder = (maxOrder?.maxOrder ?? -1) + 1;

		// Prepare values
		const id = ulid();
		await db
			.insertInto("_cms_widgets")
			.values({
				id,
				area_id: area.id,
				sort_order: sortOrder,
				type: body.type,
				title: body.title ?? null,
				content: body.content ? JSON.stringify(body.content) : null,
				menu_name: body.menuName ?? null,
				component_id: body.componentId ?? null,
				component_props: body.componentProps ? JSON.stringify(body.componentProps) : null,
			})
			.execute();

		const widget = await db
			.selectFrom("_cms_widgets")
			.selectAll()
			.$castTo<WidgetRow>()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		if (cache?.enabled) await cache.invalidate({ tags: [widgetAreaTag(name)] });
		return apiSuccess(rowToWidget(widget), 201);
	} catch (error) {
		return handleError(error, "Failed to create widget", "WIDGET_CREATE_ERROR");
	}
};
