import type { PageServerLoad } from './$types';
import { calendarManifestGet,calendarUserGet } from '$lib/server/calendar/admin-http.ts';
import { resolveLocale } from '$lib/ui/locales/config.ts';
export const load:PageServerLoad=async event=>{
  const locale=resolveLocale(event.request);
  const response=await calendarManifestGet(event);
  if(!response.ok){const body=await response.json();return {available:false,error:body.error?.message??'Calendar is unavailable',manifest:undefined,user:undefined,locale};}
  const manifest=(await response.json()).data;
  const current=await calendarUserGet(event);
  return {available:true,error:undefined,manifest,user:current.ok?(await current.json()).data??undefined:undefined,locale};
};
