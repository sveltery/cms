import type { RequestHandler } from './$types';
import { calendarManifestGet } from '$lib/server/calendar/admin-http.ts';
export const GET:RequestHandler=event=>calendarManifestGet(event);
