// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import {handleTaxonomyGet,handleTaxonomyDefTranslations} from '$lib/server/taxonomies/handlers.ts';

export const GET:RequestHandler=event=>withTaxonomyRequest(event,false,'taxonomies:read','TAXONOMY_TRANSLATIONS_ERROR','Failed to list taxonomy translations',async db=>{
 if(!event.params.name)return apiError('VALIDATION_ERROR','Taxonomy name required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 const anchor=await handleTaxonomyGet(db,event.params.name,query);if(!anchor.success)return unwrapResult(anchor);
 return unwrapResult(await handleTaxonomyDefTranslations(db,anchor.data.taxonomy.id));
});
