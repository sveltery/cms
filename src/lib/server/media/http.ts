import type {RequestEvent} from '@sveltejs/kit';
import {env} from '$env/dynamic/private';
import {apiError} from './source/api/error.ts';
import {isRoleLevel} from '../auth/roles.ts';
import {requireSessionMutationOrigin,SessionOriginError} from '../auth/request.ts';
import type {Permission} from '../database/service.ts';
import {mediaDatabase} from './schema.ts';
import {requestMediaStorage} from './storage.ts';
import {NativeMediaRuntime} from './runtime.ts';
import type {APIRoute} from './route-context.ts';
import * as media from './source/astro/routes/api/media.ts';
import * as item from './source/astro/routes/api/media/[id].ts';
import * as confirm from './source/astro/routes/api/media/[id]/confirm.ts';
import * as upload from './source/astro/routes/api/media/[id]/upload.ts';
import * as replace from './source/astro/routes/api/media/[id]/replace.ts';
import * as uploadUrl from './source/astro/routes/api/media/upload-url.ts';
import * as folders from './source/astro/routes/api/media/folders/index.ts';
import * as folder from './source/astro/routes/api/media/folders/[id].ts';
import * as asset from './source/astro/routes/api/media/asset/[id]/[filename].ts';

/** Route bodies stay pinned; session identity, mutation origin and hosting are native. */
export async function mediaHttp(event:RequestEvent,segments=''):Promise<Response>{
 const parts=segments.split('/').filter(Boolean),method=event.request.method==='HEAD'?'GET':event.request.method;
 let routes:Partial<Record<'GET'|'POST'|'PUT'|'DELETE',APIRoute>>;let params:Record<string,string|undefined>={};
 if(parts.length===0)routes=media;
 else if(parts[0]==='folders'&&parts.length===1)routes=folders;
 else if(parts[0]==='folders'&&parts.length===2){routes=folder;params={id:parts[1]};}
 else if(parts[0]==='upload-url'&&parts.length===1)routes=uploadUrl;
 else if(parts[0]==='asset'&&parts.length===3){routes=asset;params={id:parts[1],filename:parts[2]};}
 else if(parts.length===1){routes=item;params={id:parts[0]};}
 else if(parts.length===2&&['confirm','upload','replace'].includes(parts[1])){
  routes=parts[1]==='confirm'?confirm:parts[1]==='upload'?upload:replace;params={id:parts[0]};
 }else return apiError('NOT_FOUND','Media endpoint not found',404);
 const handler=routes[method as keyof typeof routes];if(!handler)return apiError('METHOD_NOT_ALLOWED','Method not allowed',405);
 const context=event.locals.cms,principal=context?.principal;
 if(!principal)return apiError('UNAUTHENTICATED','Authentication required',401);
 const write=!['GET','HEAD','OPTIONS'].includes(method);
 const permission:Permission=!write?'media:read':parts[0]==='folders'?'media:edit_any':method==='DELETE'?'media:delete_own':parts.length===0||parts[0]==='upload-url'||parts[1]==='upload'||parts[1]==='confirm'?'media:upload':'media:edit_own';
 if(!principal.permissions.includes(permission))return apiError('FORBIDDEN','Insufficient permissions',403);
 if(write){
  if(context?.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Media mutations are disabled',503);
  try{requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??event.url.origin);}
  catch(cause){if(cause instanceof SessionOriginError)return apiError(cause.code,cause.message,403);throw cause;}
 }
 if(event.url.searchParams.get('includeUsage')==='1')return apiError('MEDIA_USAGE_NOT_CONFIGURED','Media usage is not configured',503);
 if(!context?.database)return apiError('NOT_CONFIGURED','Media storage is not configured',503);
 const actor=await context.database.db.selectFrom('_cms_auth_users').select(['id','role']).where('id','=',principal.id).where('disabled','=',0).executeTakeFirst();
 if(!actor||!isRoleLevel(actor.role))return apiError('UNAUTHENTICATED','Authentication required',401);
 const host=event.platform?.env,max=env.SVELTERY_MAX_UPLOAD_SIZE??(typeof host?.SVELTERY_MAX_UPLOAD_SIZE==='string'?host.SVELTERY_MAX_UPLOAD_SIZE:undefined);
 const runtime=new NativeMediaRuntime(mediaDatabase(context.database),await requestMediaStorage(event),max===undefined?{}:{maxUploadSize:Number(max)});
 return handler({request:event.request,url:event.url,params,locals:{emdash:runtime,user:{id:actor.id,role:actor.role}}});
}
