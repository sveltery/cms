import {error,redirect} from '@sveltejs/kit';
import {base} from '$app/paths';
import type {PageServerLoad} from './$types';
import {generalMediaDatabase} from '$lib/server/general-media/storage';
import {handleMediaList} from '$lib/server/general-media/upstream/api/handlers/media';
export const load:PageServerLoad=async({locals,url})=>{
 const context=locals.cms;if(!context?.principal)redirect(303,`${base}/login`);
 if(!context.principal.permissions.includes('media:read'))error(403,'Insufficient permissions');
 // Native SSR transport of the pinned MediaPage's initial page/folder query.
 const folderId=url.searchParams.get('folder')??undefined;
 const result=await handleMediaList(generalMediaDatabase(context.database),{page:1,limit:35,folderId:folderId??null});
 if(!result.success)error(503,'Media library is unavailable');
 return {items:result.data.items.map(item=>({...item,url:`${base}/_emdash/api/media/file/${item.storageKey}`})),totalCount:result.data.totalCount??0,
  folderId,actorId:context.principal.id,permissions:context.principal.permissions};
};
