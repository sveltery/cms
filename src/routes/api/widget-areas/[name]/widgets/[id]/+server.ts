import type { RequestHandler } from './$types';
import { sectionWidgetRequest } from '$lib/server/sections-widgets/request';
import * as source from '$lib/server/sections-widgets/routes/widget-entry';
export const PUT: RequestHandler = event => sectionWidgetRequest(event, 'widgets', 'manage', source.PUT);
export const DELETE: RequestHandler = event => sectionWidgetRequest(event, 'widgets', 'manage', source.DELETE);
