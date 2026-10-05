// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import { handleTaxonomyGet,handleTaxonomyUpdate,handleTaxonomyDelete } from '$lib/server/taxonomies/handlers.ts';
import { updateTaxonomyDefBody } from '$lib/server/taxonomies/schemas.ts';

export const GET:RequestHandler=event=>withTaxonomyRequest(event,false,'taxonomies:read','TAXONOMY_GET_ERROR','Failed to get taxonomy',async db=>{
 if(!event.params.name)return apiError('VALIDATION_ERROR','Taxonomy name required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 return unwrapResult(await handleTaxonomyGet(db,event.params.name,query));
});
export const PUT:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TAXONOMY_UPDATE_ERROR','Failed to update taxonomy',async(db,storage)=>{
 if(!event.params.name)return apiError('VALIDATION_ERROR','Taxonomy name required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 const body=await parseBody(event.request,updateTaxonomyDefBody);if(isParseError(body))return body;
 const result=await handleTaxonomyUpdate(db,event.params.name,{...body,locale:query.locale});
 if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(event.params.name)]);
 return unwrapResult(result);
});
export const DELETE:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TAXONOMY_DELETE_ERROR','Failed to delete taxonomy',async(db,storage)=>{
 if(!event.params.name)return apiError('VALIDATION_ERROR','Taxonomy name required',400);
 const result=await handleTaxonomyDelete(db,event.params.name);
 if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(event.params.name)]);
 return unwrapResult(result);
});
