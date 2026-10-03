import {getRequestEvent} from '$app/server';
import {CmsError} from '../../database/contract.ts';
import {handleDashboardStats} from './handler.ts';
export async function requestDashboard(){
 const event=getRequestEvent(),context=event.locals.cms;
 if(!context?.principal)throw new CmsError('UNAUTHENTICATED');
 // Exact pinned dashboard route requires content:read, including subscriber.
 if(!context.principal.permissions.includes('content:read'))throw new CmsError('FORBIDDEN');
 if(!context.database)throw new CmsError('NOT_FOUND','Dashboard storage is not configured');
 const result=await handleDashboardStats(context.database.db as any,event.locals.cmsDashboardNow);
 if(!result.success)throw new Error(result.error.code);
 return result.data;
}
