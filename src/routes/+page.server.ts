import {redirect} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async event=>{
 const context=event.locals.cms;
 if(event.locals.cmsRuntime&&context?.database){
  // First-run routing uses actual persisted authority rows. Existing configured
  // sites remain accessible while operator completion state is recovered.
  const count=await context.database.db.selectFrom('_cms_auth_users').select(eb=>eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
  if(Number(count.count)===0)redirect(303,`${event.locals.cmsRuntime.basePath}/setup`);
 }
};
