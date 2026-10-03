import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { CmsError } from '../database/contract.ts';
import { SchemaRegistry } from '../database/registry.ts';
import { cmsService } from '../database/service.ts';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { apiError, apiSuccess, handleError } from './upstream/api/error.ts';
import { parseBody, isParseError } from './upstream/api/parse.ts';

// Native bridge for four stored Source ContentTypeEditor settings only.
const settingsBody = z.object({
 input:z.object({commentsEnabled:z.boolean(),commentsModeration:z.enum(['all','first_time','none']),commentsClosedAfterDays:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),commentsAutoApproveUsers:z.boolean()}).strict(),
 expected:z.object({version:z.number().int().min(1),updatedAt:z.string()}).strict()
}).strict();
export async function commentSettingsRequest(event:RequestEvent):Promise<Response>{
 const context=event.locals.cms,principal=context?.principal;
 if(!principal)return apiError('NOT_AUTHENTICATED','Authentication required',401);
 if(!principal.permissions.includes('comments:settings')||!principal.permissions.includes('schema:manage'))return apiError('FORBIDDEN','Insufficient permission',403);
 if(!context?.database)return apiError('COMMENTS_UNAVAILABLE','Comments settings storage is unavailable',503);
 if(event.request.method==='PUT'){
  if(context.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Mutations are disabled',503);
  const origin=event.locals.cmsRuntime?.publicOrigin;
  if(!origin)return apiError('COMMENTS_UNAVAILABLE','Comments settings storage is unavailable',503);
  try{requireSessionMutationOrigin(event.request,origin);}catch(error){if(error instanceof SessionOriginError)return apiError(error.code,error.message,403);throw error;}
 }
 try{
  const registry=new SchemaRegistry(context.database);
  const collection=await registry.getCollection(event.params.collection);
  if(!collection)return apiError('NOT_FOUND','Collection not found',404);
  if(event.request.method!=='PUT')return apiSuccess(collection);
  if(String(collection.source)==='code')return apiError('VALIDATION_ERROR','This collection is defined in code',400);
  const body=await parseBody(event.request,settingsBody);if(isParseError(body))return body;
  return apiSuccess(await cmsService(context.database,principal).updateCollection({collection:collection.slug,input:body.input,expected:body.expected}));
 }catch(error){
  if(error instanceof CmsError){const status=error.code==='NOT_FOUND'?404:error.code==='VALIDATION_ERROR'?400:error.code==='FORBIDDEN'?403:error.code==='UNAUTHENTICATED'?401:409;return apiError(error.code,error.code==='CONFLICT'?'Collection has changed. Reload before saving.':error.message,status);}
  return handleError(error,'Failed to update comment settings','COMMENT_SETTINGS_ERROR');
 }
}
