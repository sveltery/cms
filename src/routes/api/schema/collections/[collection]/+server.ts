import type { RequestHandler } from '@sveltejs/kit';
import { schemaAdminHttp } from '$lib/server/schema/admin-http';
import { requireSchemaDeletionReady } from '$lib/schema-admin/deletion-readiness';
export const GET: RequestHandler = event => schemaAdminHttp(event, false, async service => ({ item: await service.getCollection(event.params.collection) }));
export const PUT: RequestHandler = event => schemaAdminHttp(event, true, async service => {
  const { input, expected } = await event.request.json();
  return { item: await service.updateCollection({ collection: event.params.collection, input, expected }) };
});
export const DELETE: RequestHandler = event => schemaAdminHttp(event, true, async () => requireSchemaDeletionReady());
