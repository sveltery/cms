import {form,query,getRequestEvent} from '$app/server';
import {error} from '@sveltejs/kit';
import * as v from 'valibot';
import {requestIdentity} from '$lib/server/auth/identity-request';
import {AuthFlowError,setupStatus} from '$lib/server/auth/passkey-flow';
import {SessionOriginError} from '$lib/server/auth/request';
import {setupSite} from '$lib/server/setup/service';
async function setupResponse<T>(action:()=>Promise<T>):Promise<T>{
 try{return await action();}
 catch(cause){
  if(cause instanceof AuthFlowError)error(cause.status,{code:cause.code,message:'Setup request failed'});
  if(cause instanceof SessionOriginError)error(403,{code:cause.code,message:'Cross-origin setup blocked'});
  error(500,{code:'SEED_ERROR',message:'Failed to apply seed'});
 }
}
export const getSiteSetup=query(()=>setupResponse(async()=>{
 const event=getRequestEvent(),status=await setupStatus(requestIdentity(event));
 const seed=event.locals.cmsSetupSeed;
 return {...status,seedInfo:seed?{name:seed.meta?.name||'Unknown Template',description:seed.meta?.description||'',collections:seed.collections?.length||0,hasContent:!!(seed.content&&Object.keys(seed.content).length>0),title:seed.settings?.title,tagline:seed.settings?.tagline}:null};
}));
export const setupSiteConfiguration=form(v.strictObject({
 title:v.pipe(v.string(),v.minLength(1,'Site title is required')),
 tagline:v.optional(v.string()),includeContent:v.optional(v.boolean(),false)
}),input=>setupResponse(async()=>{
 const event=getRequestEvent();const result=await setupSite(requestIdentity(event,true),input,event.locals.cmsSetupSeed);
 void getSiteSetup().refresh();return result;
}));
