import {form,query} from '$app/server';
import * as v from 'valibot';
import {contentResponse} from '$lib/server/content/request';
import {requestSettings} from '$lib/server/settings/request';
const optionalText=v.optional(v.string());
const social=v.optional(v.strictObject({twitter:optionalText,github:optionalText,facebook:optionalText,instagram:optionalText,linkedin:optionalText,youtube:optionalText}));
const seo=v.optional(v.strictObject({titleSeparator:optionalText,robotsTxt:optionalText,googleVerification:optionalText,bingVerification:optionalText}));
export const getSiteSettings=query(()=>contentResponse(()=>requestSettings().get()));
export const updateSiteSettings=form(v.strictObject({title:optionalText,tagline:optionalText,url:optionalText,
 postsPerPage:v.optional(v.number()),dateFormat:optionalText,timezone:optionalText,social,seo}),input=>contentResponse(async()=>{
 const data=await requestSettings(true).update(input);void getSiteSettings().refresh();return{saved:true};
}));
