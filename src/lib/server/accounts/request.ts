import type {RequestEvent} from '@sveltejs/kit';
import {z} from 'zod';
import {requireSessionMutationOrigin,SessionOriginError} from '../auth/request.ts';
import {identityDb} from '../auth/identity-store.ts';
import {identityFailure,identitySuccess} from '../auth/identity-request.ts';
import {accountsRepository,AccountError} from './repository.ts';
import {parseBody,parseQuery,isParseError} from '../sections-widgets/api/parse.ts';
export {parseBody,parseQuery,isParseError};
export const usersListQuery=z.object({search:z.string().optional(),role:z.string().optional(),cursor:z.string().max(2048).optional(),limit:z.coerce.number().int().min(1).max(100).optional().default(50)});
const roleLevel=z.coerce.number().int().refine((n):n is 10|20|30|40|50=>[10,20,30,40,50].includes(n),{message:'Invalid role level. Must be 10, 20, 30, 40, or 50'});
export const userUpdateBody=z.object({name:z.string().optional(),email:z.email().optional(),role:roleLevel.optional()});
export async function requestAccounts(event:RequestEvent,mutation=false){
 const context=event.locals.cms;if(!context?.database)throw new AccountError('NOT_CONFIGURED','Database not configured',500);
 const principal=context.principal;
 if(!principal)throw new AccountError('FORBIDDEN','Admin privileges required',403);
 const actor=await identityDb(context.database).selectFrom('_cms_auth_users').select(['role','disabled']).where('id','=',principal.id).executeTakeFirst();
 if(!actor||actor.role<50||actor.disabled!==0)throw new AccountError('FORBIDDEN','Admin privileges required',403);
 if(mutation){
  if(!event.locals.cmsRuntime)throw new AccountError('NOT_CONFIGURED','Trusted runtime is not configured',503);
  requireSessionMutationOrigin(event.request,event.locals.cmsRuntime.publicOrigin);
  if(!context.mutationsEnabled)throw new AccountError('MUTATIONS_DISABLED','Account mutations are disabled',503);
 }
 return {repository:accountsRepository(context.database),actorId:principal.id};
}
export async function accountBody(event:RequestEvent){
 return parseBody(event.request,userUpdateBody);
}
const fallbackMessages:Record<string,string>={
 USER_LIST_ERROR:'Failed to list users',USER_DETAIL_ERROR:'Failed to get user details',
 USER_UPDATE_ERROR:'Failed to update user',USER_DISABLE_ERROR:'Failed to disable user',USER_ENABLE_ERROR:'Failed to enable user'
};
export async function accountsApi(code:string,action:()=>Promise<unknown>){
 try{const result=await action();return result instanceof Response?result:identitySuccess(result);}
 catch(cause){if(cause instanceof AccountError)return identityFailure(cause.code,cause.message,cause.status);
  if(cause instanceof SessionOriginError)return identityFailure(cause.code,cause.message,403);
  return identityFailure(code,fallbackMessages[code]??'Account request failed',500);
 }
}

/** Source checks the optional route ID before stored-user lookup. */
export function requiredUserId(id:string|undefined,code='MISSING_PARAM'):string {
 if(!id)throw new AccountError(code,'User ID required',400);return id;
}
