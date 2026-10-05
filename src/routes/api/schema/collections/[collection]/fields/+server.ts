import type { RequestHandler } from '@sveltejs/kit';
import { schemaAdminHttp } from '$lib/server/schema/admin-http';
export const POST: RequestHandler = event => schemaAdminHttp(event, true, async service => {
  const { input, expectedSchemaVersion } = await event.request.json();
  return { item: await service.addField({ collection: event.params.collection, input, expectedSchemaVersion }) };
});
