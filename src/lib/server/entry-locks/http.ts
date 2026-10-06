// Native host around the complete Source lock route. No database opens/migrations/credential creation.
import type {RequestEvent} from '@sveltejs/kit';
import {CmsError} from '../database/contract.ts';
import {lifecycleService} from '../database/lifecycle/service.ts';
import {requireSessionMutationOrigin,SessionOriginError} from '../auth/request.ts';
import {apiError} from '../sections-widgets/api/error.ts';
import type {ApiResult} from './result.ts';
import type {EntryLockRouteLocals} from './route-types.ts';
import {GET,POST,DELETE} from './route.ts';
type Event=Pick<RequestEvent,'request'|'url'|'params'|'locals'>;
function failure(cause:unknown):Response{
 if(cause instanceof SessionOriginError)return apiError('INSUFFICIENT_PERMISSIONS',cause.message,403);
 if(cause instanceof CmsError){
  const code=cause.code==='FORBIDDEN'?'INSUFFICIENT_PERMISSIONS':cause.code==='NOT_FOUND'?'CONTENT_NOT_FOUND':cause.code;
  const status=cause.code==='UNAUTHENTICATED'?401:cause.code==='FORBIDDEN'?403:cause.code==='NOT_FOUND'?404:cause.code==='VALIDATION_ERROR'?400:cause.code==='MIGRATION_REQUIRED'?503:409;
  return apiError(code,cause.message,status);
 }
 return apiError('ENTRY_LOCK_ERROR','Failed to access the entry lock',500);
}
export async function entryLockHttp(event:Event,method:'GET'|'POST'|'DELETE'):Promise<Response>{
 try{
  const cms=event.locals.cms;
  if(!cms?.principal)return apiError('UNAUTHENTICATED','Authentication required',401);
  if(!cms.database)return apiError('NOT_CONFIGURED','Content storage is not configured',503);
  if(method!=='GET'){
   if(cms.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Content mutations are disabled',503);
   requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??'');
  }
  const service=lifecycleService(cms.database,cms.principal);
  const locals:EntryLockRouteLocals={user:cms.principal,emdash:{db:cms.database,
   async handleContentGet(collection,id,locale):Promise<ApiResult<unknown>>{
    try{return{success:true,data:{item:await service.getContent({type:collection,id,...(locale?{locale}: {})},{inferLocale:locale===undefined,resolveIdentifier:true})}};}
    catch(cause){const response=failure(cause);return response.json() as Promise<ApiResult<unknown>>;}
   }
  }};
  return await({GET,POST,DELETE}[method])({params:event.params,request:event.request,url:event.url,locals});
 }catch(cause){return failure(cause);}
}
