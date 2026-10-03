import {getRequestEvent} from '$app/server';
import {error} from '@sveltejs/kit';
import {CmsError} from '../database/contract.ts';
import {settingsService} from './service.ts';
export function requestSettings(mutation=false){
 const context=getRequestEvent().locals.cms;
 if(!context?.principal)throw new CmsError('UNAUTHENTICATED');
 if(!context.principal.permissions.includes(mutation?'settings:manage':'settings:read'))throw new CmsError('FORBIDDEN');
 if(mutation&&context.mutationsEnabled!==true)error(503,{code:'MUTATIONS_DISABLED',message:'Settings mutations are disabled'});
 if(!context.database)error(503,{code:'NOT_CONFIGURED',message:'Settings storage is not configured'});
 return settingsService(context.database,context.principal);
}
