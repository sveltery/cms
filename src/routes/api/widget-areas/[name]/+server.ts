import type { RequestHandler } from './$types';
import { sectionWidgetRequest } from '$lib/server/sections-widgets/request';
import * as source from '$lib/server/sections-widgets/routes/widget-area';
export const GET: RequestHandler = event => sectionWidgetRequest(event, 'widgets', 'read', source.GET);
export const DELETE: RequestHandler = event => sectionWidgetRequest(event, 'widgets', 'manage', source.DELETE);
