import type { RequestHandler } from '@sveltejs/kit';
import { schemaAdminHttp } from '$lib/server/schema/admin-http';
export const POST: RequestHandler = event => schemaAdminHttp(event, true, async service => { await service.reorderSchemaCollections(await event.request.json()); return {}; });
