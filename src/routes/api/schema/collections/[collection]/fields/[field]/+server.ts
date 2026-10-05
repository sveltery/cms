import type { RequestHandler } from '@sveltejs/kit';
import { schemaAdminHttp } from '$lib/server/schema/admin-http';
import { requireSchemaDeletionReady } from '$lib/schema-admin/deletion-readiness';
export const PUT: RequestHandler = event => schemaAdminHttp(event, true, async service => ({ item: await service.updateField({ ...await event.request.json(), collection: event.params.collection, field: event.params.field }) }));
export const DELETE: RequestHandler = event => schemaAdminHttp(event, true, async () => requireSchemaDeletionReady());
