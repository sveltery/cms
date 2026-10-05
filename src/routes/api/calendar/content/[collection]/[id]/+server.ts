import type { RequestHandler } from './$types';
import { calendarContentGet,calendarContentPost } from '$lib/server/calendar/admin-http.ts';
export const GET:RequestHandler=event=>calendarContentGet(event);
export const POST:RequestHandler=event=>calendarContentPost(event);
