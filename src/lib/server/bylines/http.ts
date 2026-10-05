import type {RequestEvent} from '@sveltejs/kit';
import type {Kysely} from 'kysely';
import {requireSessionMutationOrigin,SessionOriginError} from '../auth/request.ts';
import type {Permission} from '../database/service.ts';
import {runWithContext} from '../menus/context.ts';
import type {Database as ContextDatabase} from '../menus/database-types.ts';
import {registerBylineDatabase} from './storage.ts';
import {bylineStorageReady} from './readiness.ts';
import {apiError} from './http-errors.ts';
import type {BylineApiRoute} from './api-context.ts';
/** Consume the actual request composition; never open, migrate or install an identity. */
export async function withBylineRequest(
 event:Pick<RequestEvent,'request'|'url'|'params'|'locals'>,
 permission:Permission,
 route:BylineApiRoute
):Promise<Response> {
 const configuration=event.locals.cms;
 if(!configuration)return apiError('NOT_CONFIGURED','Bylines are not configured',503);
 if(!configuration.principal)return apiError('UNAUTHORIZED','Authentication required',401);
 if(!configuration.principal.permissions.includes(permission))return apiError('FORBIDDEN','Insufficient permissions',403);
 const mutation=!['GET','HEAD','OPTIONS'].includes(event.request.method);
 if(mutation){
  if(configuration.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Mutations are disabled',503);
  try{requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??'');}
  catch(error){if(error instanceof SessionOriginError)return apiError(error.code,error.message,403);throw error;}
 }
 if(!await bylineStorageReady(configuration.database))return apiError('MIGRATION_REQUIRED','Byline storage is not ready',503);
 const db=registerBylineDatabase(configuration.database);
 try{
  return await runWithContext({db:db as unknown as Kysely<ContextDatabase>,locale:event.url.searchParams.get('locale')??undefined,editMode:false,keepAlive:configuration.keepAlive},()=>route({request:event.request,url:event.url,params:event.params,locals:{emdash:{db},user:configuration.principal}}));
 }catch(error){console.error('[BYLINE_REQUEST_ERROR]',error);return apiError('BYLINE_REQUEST_ERROR','Byline request failed',500);}
}
