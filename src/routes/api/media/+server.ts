import type {RequestHandler} from './$types';
import {apiError,apiSuccess} from '$lib/server/media/source/api/error';
import {handleMediaList} from '$lib/server/media/source/api/handlers/media';
import {mediaListQuery} from '$lib/server/media/source/api/schemas/media';
import {mediaDatabase} from '$lib/server/media/schema';

export const GET:RequestHandler=async event=>{
  const context=event.locals.cms;
  if(!context?.principal) return apiError('UNAUTHENTICATED','Authentication required',401);
  if(!context.principal.permissions.includes('media:read')) return apiError('FORBIDDEN','Insufficient permissions',403);
  const query=mediaListQuery.safeParse(Object.fromEntries(event.url.searchParams));
  if(!query.success) return apiError('VALIDATION_ERROR','Invalid media query',400);
  if(query.data.includeUsage) return apiError('NOT_CONFIGURED','Media usage is not configured',503);
  const result=await handleMediaList(mediaDatabase(context.database),{...query.data,folderId:query.data.folderId==='unfiled'?null:query.data.folderId});
  return result.success ? apiSuccess(result.data):apiError(result.error.code,result.error.message,result.error.code==='INVALID_CURSOR'||result.error.code==='VALIDATION_ERROR'?400:500);
};
