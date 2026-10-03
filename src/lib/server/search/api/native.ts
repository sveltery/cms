import type {RequestEvent} from '@sveltejs/kit';
import type {Kysely} from 'kysely';
import type {Database} from '../../database/lifecycle/upstream/database/types.ts';
import {requireSessionMutationOrigin,SessionOriginError} from '../../auth/request.ts';
import {apiError,type SourceSearchRoute} from './support.ts';
/** Native transport preserves stored-session authority and deployment gates. */
export async function nativeSearchRoute(event:RequestEvent,route:SourceSearchRoute,mutation=false) {
 const context=event.locals.cms;
 if(mutation&&context?.principal?.permissions.includes('search:manage')) {
  if(context.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Search mutations are disabled',503);
  try{requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??event.url.origin);}
  catch(cause){if(cause instanceof SessionOriginError)return apiError(cause.code,cause.message,403);throw cause;}
 }
 return route({url:event.url,request:event.request,locals:{user:context?.principal??null,
  ...(context?.database?{emdash:{db:context.database.db as unknown as Kysely<Database>,ensureSearchHealthy:event.locals.cmsSearch?.ensureHealthy}}:{})}});
}
