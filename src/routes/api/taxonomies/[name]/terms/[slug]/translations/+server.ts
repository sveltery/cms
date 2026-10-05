// Native Kit transport for pinned EmDash taxonomy contracts; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { parseBody, parseQuery, isParseError } from '$lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '$lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '$lib/server/menus/schema-common.ts';
import { taxonomyCacheInvalidator } from '$lib/server/taxonomies/cache.ts';
import { taxonomyTag } from '$lib/server/sections-widgets/chrome-tags.ts';
export const prerender=false;
import {handleTermGet,handleTermTranslations,handleTermCreate} from '$lib/server/taxonomies/handlers.ts';
import {createTermTranslationBody} from '$lib/server/taxonomies/schemas.ts';

export const GET:RequestHandler=event=>withTaxonomyRequest(event,false,'taxonomies:read','TERM_TRANSLATIONS_ERROR','Failed to list term translations',async db=>{
 if(!event.params.name||!event.params.slug)return apiError('VALIDATION_ERROR','Taxonomy name and slug required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 const anchor=await handleTermGet(db,event.params.name,event.params.slug,query);if(!anchor.success)return unwrapResult(anchor);
 return unwrapResult(await handleTermTranslations(db,anchor.data.term.id));
});
export const POST:RequestHandler=event=>withTaxonomyRequest(event,true,'taxonomies:manage','TERM_TRANSLATION_CREATE_ERROR','Failed to create term translation',async(db,storage)=>{
 if(!event.params.name||!event.params.slug)return apiError('VALIDATION_ERROR','Taxonomy name and slug required',400);
 const query=parseQuery(event.url,localeFilterQuery);if(isParseError(query))return query;
 const body=await parseBody(event.request,createTermTranslationBody);if(isParseError(body))return body;
 const source=await handleTermGet(db,event.params.name,event.params.slug,query);if(!source.success)return unwrapResult(source);
 const term=source.data.term;
 const result=await handleTermCreate(db,event.params.name,{slug:body.slug??term.slug,label:body.label??term.label,
   parentId:term.parentId,description:term.description,locale:body.locale,translationOf:term.id});
 if(result.success)await taxonomyCacheInvalidator(storage)?.([taxonomyTag(event.params.name)]);
 return unwrapResult(result,201);
});
