import type { RequestHandler } from './$types';
import { apiSuccess } from '$lib/server/sections-widgets/api/error';
import { getWidgetComponents } from '$lib/server/sections-widgets/widgets/components';
// Pinned Source publishes this built-in registry without requiring storage or a user.
export const GET: RequestHandler = () => apiSuccess({ items: getWidgetComponents() });
