import type { RequestHandler } from './$types';
import { calendarGet } from '$lib/server/calendar/http.ts';
export const prerender = false;
export const GET: RequestHandler = calendarGet;
