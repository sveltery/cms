import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { CmsError } from '../database/contract';
import { lifecycleService } from '../database/lifecycle/service';

/** Trusted server locals, shared with the existing native content transport. */
export function requestLifecycle(operation:'read'|'mutation'='read') {
  const context=getRequestEvent().locals.cms;
  if(!context?.principal)throw new CmsError('UNAUTHENTICATED');
  if(operation==='mutation'&&context.mutationsEnabled!==true)error(503,{message:'Content mutations are disabled',code:'MUTATIONS_DISABLED'});
  if(!context.database)error(503,{message:'Content storage is not configured',code:'NOT_CONFIGURED'});
  return lifecycleService(context.database,context.principal);
}
