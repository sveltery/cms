import type { RequestHandler } from './$types';
import { withContentPickerRequest } from '$lib/server/content-picker/http.ts';
export const prerender = false;
export const GET: RequestHandler = event => withContentPickerRequest(event, async service => ({ items: await service.collections() }));
