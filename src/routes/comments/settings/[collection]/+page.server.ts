import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { commentSettingsRequest } from '$lib/server/comments/settings.ts';
export const load:PageServerLoad=async event=>{
 const response=await commentSettingsRequest(event),payload=await response.json();
 if(!response.ok)error(response.status,{message:payload.error?.message??'Comment settings are unavailable'});
 return {collection:payload.data,basePath:event.locals.cmsRuntime?.basePath??'',mutationsEnabled:event.locals.cms?.mutationsEnabled===true};
};
