import type { RequestHandler } from './$types';
import type { Kysely } from 'kysely';
import type { Database } from '$lib/server/seo/types';
import { collectionSitemapResponse } from '$lib/server/seo/sitemap-response';

export const prerender = false;
export const GET: RequestHandler = ({ locals, params, url }) => collectionSitemapResponse({
  db: locals.cms?.database.db as unknown as Kysely<Database> ?? null,
  collection: params.collection,
  url,
  publicOrigin: locals.cmsRuntime?.publicOrigin,
  basePath: locals.cmsRuntime?.basePath
});
