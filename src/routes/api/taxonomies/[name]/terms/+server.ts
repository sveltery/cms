// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import {handleTermList,handleTermCreate} from '$lib/server/taxonomies/handlers.ts';
import {termListQuery,createTermBody} from '$lib/server/taxonomies/schemas.ts';

export const GET:RequestHandler=event=>withTaxonomyRequest(event,false,'taxonomies:read','TERMS_LIST_ERROR','Failed to list terms',async db=>{
 if(!event.params.name)return apiError('VALIDATION_ERROR','Taxonomy name required',400);
 const query=parseQuery(event.url,termListQuery);if(isParseError(query))return query;
 return unwrapResult(await handleTermList(db,event.params.name,query));
});
export const POST:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TERM_CREATE_ERROR','Failed to create term',async(db,storage)=>{
 if(!event.params.name)return apiError('VALIDATION_ERROR','Taxonomy name required',400);
 const body=await parseBody(event.request,createTermBody);if(isParseError(body))return body;
 const result=await handleTermCreate(db,event.params.name,body);
 if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(event.params.name)]);
 return unwrapResult(result,201);
});
