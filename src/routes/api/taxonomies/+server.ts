// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import { handleTaxonomyList, handleTaxonomyCreate } from '$lib/server/taxonomies/handlers.ts';
import { createTaxonomyDefBody } from '$lib/server/taxonomies/schemas.ts';

export const GET:RequestHandler=event=>withTaxonomyRequest(event,false,'taxonomies:read','TAXONOMY_LIST_ERROR','Failed to list taxonomies',async db=>{
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 return unwrapResult(await handleTaxonomyList(db,query));
});
export const POST:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TAXONOMY_CREATE_ERROR','Failed to create taxonomy',async(db,storage)=>{
 const body=await parseBody(event.request,createTaxonomyDefBody);if(isParseError(body))return body;
 const result=await handleTaxonomyCreate(db,body);if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(body.name)]);
 return unwrapResult(result,201);
});
