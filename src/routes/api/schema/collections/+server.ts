import type { RequestHandler } from '@sveltejs/kit';
import { schemaAdminHttp } from '$lib/server/schema/admin-http';
export const GET: RequestHandler = event => schemaAdminHttp(event, false, async service => ({ items: await service.listCollections() }));
export const POST: RequestHandler = event => schemaAdminHttp(event, true, async service => ({ item: await service.createCollection(await event.request.json()) }));
