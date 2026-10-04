// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import {handleTermReorder} from '$lib/server/taxonomies/handlers.ts';
import {reorderTermsBody} from '$lib/server/taxonomies/schemas.ts';

export const POST:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TERM_REORDER_ERROR','Failed to reorder terms',async(db,storage)=>{
 if(!event.params.name)return apiError('VALIDATION_ERROR','Taxonomy name required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 const body=await parseBody(event.request,reorderTermsBody);if(isParseError(body))return body;
 const result=await handleTermReorder(db,event.params.name,body);
 if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(event.params.name)]);
 return unwrapResult(result);
});
