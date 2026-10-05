// TEST ONLY: unchanged Source APIContext supplied to the real XML producer.
import { collectionSitemapResponse } from '../../../src/lib/server/seo/sitemap-response.ts';
import { SOURCE_SEO_STORAGE } from '../../../src/lib/server/seo/storage.ts';
export const GET = ({params, locals, url}) => collectionSitemapResponse({
  db: locals.emdash?.db ?? null, collection: params.collection, url,
  publicOrigin: locals.emdash?.config?.siteUrl
}, SOURCE_SEO_STORAGE);
