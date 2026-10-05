// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import {handleBulkTag} from '$lib/server/taxonomies/bulk-tag.ts';
import {bulkTagBody} from '$lib/server/taxonomies/schemas.ts';

export const POST:RequestHandler=event=>withTaxonomyRequest(event,true,'content:edit_any','BULK_TAG_ERROR','Failed to bulk tag posts',async(db,storage)=>{
 const body=await parseBody(event.request,bulkTagBody);if(isParseError(body))return body;
 return unwrapResult(await handleBulkTag(db,event.locals.cmsRuntime?.publicOrigin??event.url.origin,body,taxonomyCacheInvalidator(storage)));
});
