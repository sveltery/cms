// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Source whole redirect Astro routes at 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Owned SvelteKit transport uses only the existing trusted server locals.
import type {CmsDatabase} from '../database/contract.ts';
import {withCanonicalFeatureNamespaces} from '../database/canonical-features/namespaces.ts';
import type {ServerPrincipal} from '../database/service.ts';
import type {Database} from './database-types.ts';
import {redirectSchemaPresent,RedirectSchemaIncompleteError} from './readiness.ts';
import {apiError,handleError,unwrapResult} from './http.ts';
import {parseBody,parseQuery,isParseError} from './parse.ts';
import {createRedirectBody,updateRedirectBody,redirectsListQuery,notFoundListQuery,
 notFoundPruneBody,notFoundSummaryQuery} from './schemas.ts';
import {handleRedirectList,handleRedirectCreate,handleRedirectGet,handleRedirectUpdate,
 handleRedirectDelete,handleNotFoundList,handleNotFoundSummary,handleNotFoundClear,
 handleNotFoundPrune} from './handlers.ts';

export type RedirectAction='list'|'create'|'get'|'update'|'delete'|'list404'|'summary404'|'clear404'|'prune404';
interface RedirectRequest {
 request:Request;url:URL;params:Record<string,string|undefined>;
 locals:{cms?:{database:CmsDatabase;principal:ServerPrincipal|null;mutationsEnabled?:boolean}};
}
const errors:Record<RedirectAction,readonly[string,string]>={
 list:['REDIRECT_LIST_ERROR','Failed to fetch redirects'],create:['REDIRECT_CREATE_ERROR','Failed to create redirect'],
 get:['REDIRECT_GET_ERROR','Failed to fetch redirect'],update:['REDIRECT_UPDATE_ERROR','Failed to update redirect'],
 delete:['REDIRECT_DELETE_ERROR','Failed to delete redirect'],list404:['NOT_FOUND_LIST_ERROR','Failed to fetch 404 log'],
 summary404:['NOT_FOUND_SUMMARY_ERROR','Failed to fetch 404 summary'],clear404:['NOT_FOUND_CLEAR_ERROR','Failed to clear 404 log'],
 prune404:['NOT_FOUND_PRUNE_ERROR','Failed to prune 404 log']
};

/** Storage availability is explicit; requests never install missing migrations. */
export async function redirectEndpoint(event:RedirectRequest,action:RedirectAction):Promise<Response> {
 const context=event.locals.cms;
 if(!context?.database)return apiError('NOT_CONFIGURED','Redirect storage is not configured',503);
 const mutation=action==='create'||action==='update'||action==='delete'||action==='clear404'||action==='prune404';
 const principal=context.principal;
 if(!principal)return apiError('UNAUTHORIZED','Authentication required',401);
 if(!principal.permissions.includes(mutation?'redirects:manage':'redirects:read'))
  return apiError('FORBIDDEN','Insufficient permissions',403);
 if(mutation&&context.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Content mutations are disabled',503);
 const [fallbackCode,fallbackMessage]=errors[action];
 try {
  if(!await redirectSchemaPresent(context.database.db))return apiError('MIGRATION_REQUIRED','Redirect storage migrations are required',503);
  const db=withCanonicalFeatureNamespaces(context.database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>());
  if(action==='list'){
   const query=parseQuery(event.url,redirectsListQuery);if(isParseError(query))return query;
   return unwrapResult(await handleRedirectList(db,query));
  }
  if(action==='create'){
   const body=await parseBody(event.request,createRedirectBody);if(isParseError(body))return body;
   return unwrapResult(await handleRedirectCreate(db,body),201);
  }
  if(action==='list404'){
   const query=parseQuery(event.url,notFoundListQuery);if(isParseError(query))return query;
   return unwrapResult(await handleNotFoundList(db,query));
  }
  if(action==='summary404'){
   const query=parseQuery(event.url,notFoundSummaryQuery);if(isParseError(query))return query;
   return unwrapResult(await handleNotFoundSummary(db,query.limit));
  }
  if(action==='clear404')return unwrapResult(await handleNotFoundClear(db));
  if(action==='prune404'){
   const body=await parseBody(event.request,notFoundPruneBody);if(isParseError(body))return body;
   return unwrapResult(await handleNotFoundPrune(db,body.olderThan));
  }
  const id=event.params.id;if(!id)return apiError('VALIDATION_ERROR','id is required',400);
  if(action==='get')return unwrapResult(await handleRedirectGet(db,id));
  if(action==='delete')return unwrapResult(await handleRedirectDelete(db,id));
  const body=await parseBody(event.request,updateRedirectBody);if(isParseError(body))return body;
  return unwrapResult(await handleRedirectUpdate(db,id,body));
 }catch(error){
  if(error instanceof RedirectSchemaIncompleteError)return apiError('MIGRATION_REQUIRED',error.message,503);
  return handleError(error,fallbackMessage,fallbackCode);
 }
}
