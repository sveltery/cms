import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'kysely';
import { ZodError } from 'zod';
import { CmsError, type CmsDatabase } from '../database/contract.ts';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { apiError } from '../menus/http-errors.ts';
import { runWithContext } from '../menus/context.ts';
import type { Database as CacheDatabase } from '../menus/database-types.ts';
import type { Kysely } from 'kysely';
import { normalizeFeatureStorageSql } from '../database/canonical-features/sql-recognition.ts';
import descriptors from '../database/canonical-features/physical-schema.json' with {type:'json'};
import { relationService } from './service.ts';

/** Read-only actual installed relation catalogue; no migration/repair/cache. */
export async function relationStorageReady(database: CmsDatabase): Promise<boolean> {
  try {
    const expected = descriptors.directedRelations.objects;
    const result = await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master
      WHERE name IN (SELECT value FROM json_each(${JSON.stringify(expected.map(object=>object.name))}))`.execute(database.db);
    return expected.every(object=>result.rows.some(row=>row.name===object.name&&row.type===object.type&&row.sql!==null
      &&normalizeFeatureStorageSql(row.sql)===normalizeFeatureStorageSql(object.sql)));
  } catch { return false; }
}

export async function withRelationRequest(event:Pick<RequestEvent,'request'|'url'|'locals'>,mutation:boolean,kind:'schema'|'content',code:string,message:string,
  run:(service:ReturnType<typeof relationService>)=>Promise<Response>):Promise<Response>{
  const configuration=event.locals.cms;
  if(!configuration)return apiError('NOT_CONFIGURED','Relations are not configured',503);
  if(!configuration.principal)return apiError('UNAUTHORIZED','Authentication required',401);
  const permission=kind==='content'?'content:read':mutation?'schema:manage':'schema:read';
  if(!configuration.principal.permissions.includes(permission))return apiError('FORBIDDEN','Insufficient permissions',403);
  if(mutation){
    if(configuration.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Mutations are disabled',503);
    try{requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??'');}
    catch(error){if(error instanceof SessionOriginError)return apiError(error.code,error.message,403);throw error;}
  }
  if(!await relationStorageReady(configuration.database))return apiError('MIGRATION_REQUIRED','Relation storage is not ready',503);
  try{
    return await runWithContext({db:configuration.database.db as unknown as Kysely<CacheDatabase>,editMode:false,keepAlive:configuration.keepAlive},
      ()=>run(relationService(configuration.database,configuration.principal)));
  }catch(error){
    if(error instanceof CmsError)return apiError(error.code,error.message,error.code==='UNAUTHENTICATED'?401:error.code==='FORBIDDEN'?403:400);
    if(error instanceof ZodError)return apiError('VALIDATION_ERROR',error.issues.map(issue=>issue.message).join('; '),400);
    console.error(`[${code}]`,error);return apiError(code,message,500);
  }
}
