import {getRequestEvent} from '$app/server';
import {error} from '@sveltejs/kit';
import {CmsError} from '../database/contract.ts';
import {TaxonomyError,taxonomyService} from './service.ts';
import {mapErrorStatus} from './upstream/api/errors.ts';
import {schemaResponse} from '../schema/request.ts';
export function requestTaxonomy(operation:'read'|'manage'|'entry-read'|'entry-mutation'='read'){
 const context=getRequestEvent().locals.cms,principal=context?.principal;
 if(!principal||typeof principal.id!=='string'||!principal.id.length||principal.id.length>128||!Array.isArray(principal.permissions))throw new CmsError('UNAUTHENTICATED');
 const required=operation==='read'?['taxonomies:read']:operation==='manage'?['taxonomies:manage']:operation==='entry-read'?['content:read']:['content:edit_own','content:edit_any'];
 if(!required.some(permission=>principal.permissions.includes(permission as any)))throw new CmsError('FORBIDDEN');
 if(operation==='entry-read'&&!principal.permissions.includes('content:read_drafts'))throw new CmsError('FORBIDDEN');
 if((operation==='manage'||operation==='entry-mutation')&&context?.mutationsEnabled!==true)error(503,{message:'Taxonomy mutations are disabled',code:'MUTATIONS_DISABLED'});
 if(!context?.database)error(503,{message:'Taxonomy storage is not configured',code:'NOT_CONFIGURED'});
 return taxonomyService(context.database,principal);
}
export function taxonomyResponse<T>(operation:()=>Promise<T>):Promise<T>{return schemaResponse(async()=>{try{return await operation();}catch(cause){if(cause instanceof TaxonomyError)error(mapErrorStatus(cause.code),{code:cause.code,message:cause.message});throw cause;}});}
