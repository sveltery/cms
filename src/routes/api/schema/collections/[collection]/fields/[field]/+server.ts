import type { RequestHandler } from '@sveltejs/kit';
import { schemaAdminHttp } from '$lib/server/schema/admin-http';
export const PUT: RequestHandler = event => schemaAdminHttp(event, true, async service => ({ item: await service.updateField({ ...await event.request.json(), collection: event.params.collection, field: event.params.field }) }));
export const DELETE: RequestHandler = event => schemaAdminHttp(event, true, async service => {
  await service.deleteSchemaField({ collection: event.params.collection, field: event.params.field }); return {};
});
