import type { RequestHandler } from './$types';
import { sectionWidgetRequest } from '$lib/server/sections-widgets/request';
import * as source from '$lib/server/sections-widgets/routes/sections-entry';
export const GET: RequestHandler = event => sectionWidgetRequest(event, 'sections', 'read', source.GET);
export const PUT: RequestHandler = event => sectionWidgetRequest(event, 'sections', 'manage', source.PUT);
export const DELETE: RequestHandler = event => sectionWidgetRequest(event, 'sections', 'manage', source.DELETE);
