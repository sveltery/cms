import type { RequestHandler } from './$types';
import { calendarUserGet } from '$lib/server/calendar/admin-http.ts';
export const GET:RequestHandler=event=>calendarUserGet(event);
