import type { RequestHandler } from './$types';
import { sectionWidgetRequest } from '$lib/server/sections-widgets/request';
import * as source from '$lib/server/sections-widgets/routes/widget-areas';
export const GET: RequestHandler = event => sectionWidgetRequest(event, 'widgets', 'read', source.GET);
export const POST: RequestHandler = event => sectionWidgetRequest(event, 'widgets', 'manage', source.POST);
