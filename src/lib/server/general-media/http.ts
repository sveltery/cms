import type { RequestEvent } from '@sveltejs/kit';
import type { Kysely } from 'kysely';
import type { Permission } from '../database/service.ts';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { runWithContext } from '../menus/context.ts';
import type { Database as RequestDatabase } from '../menus/database-types.ts';
import { apiError } from './upstream/api/error.ts';
import type { APIRoute } from './upstream/api/context.ts';
import { createMediaRequestRuntime } from './request-runtime.ts';
import { mediaStorageReady } from './readiness.ts';
/** Actual configured request transport; opens no storage, schema or identity. */
export async function withMediaRequest(event:Pick<RequestEvent,'request'|'url'|'params'|'locals'>,permission:Permission|null,route:APIRoute):Promise<Response> {
  const configuration=event.locals.cms;
  if(permission){
    if(!configuration?.principal)return apiError('UNAUTHORIZED','Authentication required',401);
    if(!configuration.principal.permissions.includes(permission))return apiError('FORBIDDEN','Insufficient permissions',403);
    if(!['GET','HEAD','OPTIONS'].includes(event.request.method)){
      if(configuration.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Mutations are disabled',503);
      try{requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??'');}
      catch(error){if(error instanceof SessionOriginError)return apiError(error.code,error.message,403);throw error;}
    }
    if(!await mediaStorageReady(configuration.database))return apiError('MIGRATION_REQUIRED','Media storage is not ready',503);
  }
  const runtime=configuration?createMediaRequestRuntime(configuration.database,configuration.storage):undefined;
  const invoke=()=>route({request:event.request,url:event.url,params:event.params,locals:{emdash:runtime,user:configuration?.principal??null}});
  try{
    return runtime?await runWithContext({db:runtime.db as unknown as Kysely<RequestDatabase>,editMode:false,keepAlive:configuration?.keepAlive},invoke):await invoke();
  }catch(error){console.error('[MEDIA_REQUEST_ERROR]',error);return apiError('MEDIA_REQUEST_ERROR','Media request failed',500);}
}
