import type {RequestHandler} from './$types';
import {z} from 'zod';
import {CmsError} from '$lib/server/database/contract';
import {AuthFlowError} from '$lib/server/auth/passkey-flow';
import {SessionOriginError} from '$lib/server/auth/request';
import {identityFailure,identitySuccess} from '$lib/server/auth/identity-request';
import {dismissCurrentWelcome,welcomeContext} from '$lib/server/welcome/service';
const bodySchema=z.object({action:z.string().min(1)});
export const POST:RequestHandler=async event=>{
 try{
  if(!event.locals.cms?.principal)return identityFailure('NOT_AUTHENTICATED','Not authenticated',401);
  welcomeContext(event);
  let body:unknown;try{body=await event.request.json();}catch{return identityFailure('INVALID_JSON','Invalid JSON body',400);}
  const parsed=bodySchema.safeParse(body);if(!parsed.success)return identityFailure('VALIDATION_ERROR','Invalid request',400);
  if(parsed.data.action!=='dismissWelcome')return identityFailure('UNKNOWN_ACTION','Unknown action',400);
  return identitySuccess(await dismissCurrentWelcome(event));
 }catch(cause){
  if(cause instanceof CmsError)return identityFailure('NOT_AUTHENTICATED','Not authenticated',401);
  if(cause instanceof SessionOriginError)return identityFailure(cause.code,'Cross-origin welcome mutation blocked',403);
  if(cause instanceof AuthFlowError)return identityFailure(cause.code,'Welcome is unavailable',cause.status);
  return identityFailure('WELCOME_DISMISS_ERROR','Failed to dismiss welcome',500);
 }
};
