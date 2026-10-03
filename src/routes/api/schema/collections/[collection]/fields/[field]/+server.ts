import type {RequestHandler} from './$types';
import {cmsService} from '$lib/server/database/service.ts';
import {CmsError} from '$lib/server/database/contract.ts';
import {requireSessionMutationOrigin,SessionOriginError} from '$lib/server/auth/request.ts';
import {apiError,apiSuccess} from '$lib/server/search/api/support.ts';
/** Native URI adaptation of the source field update, sharing the registered
 * service policy/validation/atomic registry used by SvelteKit remote forms. */
export const PUT:RequestHandler=async event=>{
 const context=event.locals.cms;
 if(!context?.principal)return apiError('UNAUTHENTICATED','Authentication required',401);
 if(!context.principal.permissions.includes('schema:manage'))return apiError('INSUFFICIENT_PERMISSIONS','Insufficient permissions',403);
 if(context.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Schema mutations are disabled',503);
 try{
  requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??event.url.origin);
  let input:unknown;try{input=await event.request.json();}catch{return apiError('INVALID_JSON','Request body must be valid JSON',400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return apiError('VALIDATION_ERROR','Invalid request data',400);
  const result=await cmsService(context.database,context.principal).updateField({...input,collection:event.params.collection,field:event.params.field});
  return apiSuccess({field:result});
 }catch(cause){if(cause instanceof SessionOriginError)return apiError(cause.code,cause.message,403);if(cause instanceof CmsError)return apiError(cause.code,cause.message,cause.code==='NOT_FOUND'?404:400);throw cause;}
};
