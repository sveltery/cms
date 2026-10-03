// EmDash1.1.0 MIT Cloudflare2026; notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/widget-components.ts
/**
 * Widget components registry endpoint
 *
 * GET /_emdash/api/widget-components - List available widget components
 */

import type { APIRoute } from "../route-types.ts";

import { apiSuccess, handleError } from "../api/error.ts";
import { getWidgetComponents } from "../widgets/components.ts";

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		const components = getWidgetComponents();

		return apiSuccess({ items: components });
	} catch (error) {
		return handleError(error, "Failed to fetch widget components", "WIDGET_COMPONENTS_ERROR");
	}
};
