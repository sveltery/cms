import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {requestSettings} from '$lib/server/settings/request';
import {CmsError} from '$lib/server/database/contract';
import {requireSessionMutationOrigin} from '$lib/server/auth/request';
const headers={'cache-control':'private, no-store'};
async function respond(action:()=>Promise<unknown>){
 try{return json({success:true,data:await action()},{headers});}
 catch(cause){if(cause instanceof CmsError){const status=cause.code==='UNAUTHENTICATED'?401:cause.code==='FORBIDDEN'?403:400;return json({success:false,error:{code:cause.code==='FORBIDDEN'?'INSUFFICIENT_PERMISSIONS':cause.code,message:cause.message}},{status,headers});}throw cause;}
}
export const GET:RequestHandler=()=>respond(()=>requestSettings().get());
export const POST:RequestHandler=event=>respond(async()=>{
 const service=requestSettings(true);
 // Native registered remote forms have the same Kit origin guard; this JSON adaptation uses the resolved URL.
 requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??event.url.origin);
 let input:unknown;try{input=await event.request.json();}catch{throw new CmsError('VALIDATION_ERROR');}
 return service.update(input);
});
