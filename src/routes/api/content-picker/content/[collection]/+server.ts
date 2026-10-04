import type { RequestHandler } from './$types';
import { withContentPickerRequest } from '$lib/server/content-picker/http.ts';
export const prerender = false;
export const GET: RequestHandler = event => withContentPickerRequest(event, service => service.list(event.params.collection, Object.fromEntries(event.url.searchParams)));
