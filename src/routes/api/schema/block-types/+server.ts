import type { RequestHandler } from '@sveltejs/kit';
import { schemaAdminHttp } from '$lib/server/schema/admin-http';
export const GET: RequestHandler = event => schemaAdminHttp(event, false, async service => ({ items: await service.listSchemaBlockTypes() }));
