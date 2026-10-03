import {form,getRequestEvent} from '$app/server';
import {error} from '@sveltejs/kit';
import * as v from 'valibot';
import {getCurrentUser} from '$lib/auth.remote';
import {CmsError} from '$lib/server/database/contract';
import {AuthFlowError} from '$lib/server/auth/passkey-flow';
import {SessionOriginError} from '$lib/server/auth/request';
import {dismissCurrentWelcome} from '$lib/server/welcome/service';
export const dismissWelcome=form(v.strictObject({}),async()=>{
 try{await dismissCurrentWelcome(getRequestEvent());void getCurrentUser().refresh();return {dismissed:true};}
 catch(cause){
  if(cause instanceof CmsError)error(401,{code:'NOT_AUTHENTICATED',message:'Not authenticated'});
  if(cause instanceof SessionOriginError)error(403,{code:cause.code,message:'Cross-origin welcome mutation blocked'});
  if(cause instanceof AuthFlowError)error(cause.status,{code:cause.code,message:'Welcome is unavailable'});
  error(500,{code:'WELCOME_DISMISS_ERROR',message:'Failed to dismiss welcome'});
 }
});
