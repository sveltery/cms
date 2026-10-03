import {redirect} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
import {setupStatus} from '$lib/server/auth/passkey-flow';
import {requestIdentity} from '$lib/server/auth/identity-request';
export const load:PageServerLoad=async event=>{
 if(event.locals.cmsRuntime&&event.locals.cms?.database){const status=await setupStatus(requestIdentity(event));if(!status.needsSetup)redirect(303,`${event.locals.cmsRuntime.basePath}/dashboard`);}
};
