import type { PageServerLoad } from './$types';
import { calendarManifestGet,calendarUserGet } from '$lib/server/calendar/admin-http.ts';
export const load:PageServerLoad=async event=>{
  const response=await calendarManifestGet(event);
  if(!response.ok){const body=await response.json();return {available:false,error:body.error?.message??'Calendar is unavailable',manifest:undefined,user:undefined};}
  const manifest=(await response.json()).data;
  const current=await calendarUserGet(event);
  return {available:true,error:undefined,manifest,user:current.ok?(await current.json()).data??undefined:undefined};
};
