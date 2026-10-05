// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import {handleTermGet,handleTermUpdate,handleTermDelete} from '$lib/server/taxonomies/handlers.ts';
import {updateTermBody} from '$lib/server/taxonomies/schemas.ts';

export const GET:RequestHandler=event=>withTaxonomyRequest(event,false,'taxonomies:read','TERM_GET_ERROR','Failed to get term',async db=>{
 if(!event.params.name||!event.params.slug)return apiError('VALIDATION_ERROR','Taxonomy name and slug required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 return unwrapResult(await handleTermGet(db,event.params.name,event.params.slug,query));
});
export const PUT:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TERM_UPDATE_ERROR','Failed to update term',async(db,storage)=>{
 if(!event.params.name||!event.params.slug)return apiError('VALIDATION_ERROR','Taxonomy name and slug required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 const body=await parseBody(event.request,updateTermBody);if(isParseError(body))return body;
 const result=await handleTermUpdate(db,event.params.name,event.params.slug,body,query);
 if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(event.params.name)]);
 return unwrapResult(result);
});
export const DELETE:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TERM_DELETE_ERROR','Failed to delete term',async(db,storage)=>{
 if(!event.params.name||!event.params.slug)return apiError('VALIDATION_ERROR','Taxonomy name and slug required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 const result=await handleTermDelete(db,event.params.name,event.params.slug,query);
 if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(event.params.name)]);
 return unwrapResult(result);
});
