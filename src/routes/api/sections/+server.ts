import type { RequestHandler } from './$types';
import { sectionWidgetRequest } from '$lib/server/sections-widgets/request';
import * as source from '$lib/server/sections-widgets/routes/sections-list';
export const GET: RequestHandler = event => sectionWidgetRequest(event, 'sections', 'read', source.GET);
export const POST: RequestHandler = event => sectionWidgetRequest(event, 'sections', 'manage', source.POST);
