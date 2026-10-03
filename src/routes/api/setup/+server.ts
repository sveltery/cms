import type {RequestHandler} from './$types';
import {identityApi,identitySuccess,identityFailure} from '$lib/server/auth/identity-request';
import {assertSiteSetupOpen,setupSite} from '$lib/server/setup/service';
export const POST:RequestHandler=event=>identityApi(event,'SETUP_ERROR',async context=>{
 await assertSiteSetupOpen(context);
 const length=event.request.headers.get('Content-Length');
 if(length&&parseInt(length,10)>10*1024*1024)return identityFailure('PAYLOAD_TOO_LARGE','Request body too large',413);
 let input:unknown;try{input=JSON.parse(await event.request.text());}catch{return identityFailure('INVALID_JSON','Invalid JSON body',400);}
 try{return identitySuccess(await setupSite(context,input,event.locals.cmsSetupSeed));}
 catch(cause){if(cause instanceof Error&&cause.name==='SetupSeedError')return identityFailure('SEED_ERROR','Failed to apply seed',500);throw cause;}
});
