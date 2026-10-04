import type { RequestEvent } from '@sveltejs/kit';
import type { Kysely } from 'kysely';
import type { Permission } from '../database/service.ts';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from './database-types.ts';
import { canonicalSourceDatabase } from '../canonical-storage/namespace.ts';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { apiError } from '../menus/http-errors.ts';
import { runWithContext } from '../menus/context.ts';
import { taxonomyStorageReady } from './readiness.ts';

/** Consume existing trusted composition and origin guard. Never open/migrate storage. */
export async function withTaxonomyRequest(event: Pick<RequestEvent,'request'|'url'|'locals'>,
 mutation: boolean, permission: Permission | readonly Permission[], code: string, message: string,
 run: (db: Kysely<Database>, storage:CmsDatabase)=>Promise<Response>): Promise<Response> {
 const cms=event.locals.cms;
 if(!cms)return apiError('NOT_CONFIGURED','Taxonomies are not configured',503);
 if(!cms.principal)return apiError('UNAUTHORIZED','Authentication required',401);
 const permissions=typeof permission==='string'?[permission]:permission;
 if(!permissions.some(candidate=>cms.principal!.permissions.includes(candidate)))return apiError('FORBIDDEN','Insufficient permissions',403);
 if(mutation){
  if(cms.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Mutations are disabled',503);
  try{requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??'');}
  catch(error){if(error instanceof SessionOriginError)return apiError(error.code,error.message,403);throw error;}
 }
 if(!await taxonomyStorageReady(cms.database))return apiError('MIGRATION_REQUIRED','Taxonomy storage is not ready',503);
 const db=canonicalSourceDatabase(cms.database) as unknown as Kysely<Database>;
 try{return await runWithContext({db:db as any,locale:event.url.searchParams.get('locale')??undefined,editMode:false,
   keepAlive:cms.keepAlive},()=>run(db,cms.database));}
 catch(error){console.error(`[${code}]`,error);return apiError(code,message,500);}
}
