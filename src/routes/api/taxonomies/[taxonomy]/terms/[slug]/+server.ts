import {json,error} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {requestTaxonomy,taxonomyResponse} from '$lib/server/taxonomies/request';
export const DELETE:RequestHandler=async({params,request,url})=>taxonomyResponse(async()=>{
 // Cookie-authenticated DELETE requires a same-origin request independently of form CSRF.
 const service=requestTaxonomy('manage');
 if(request.headers.get('origin')!==url.origin)error(403,{message:'Cross-origin taxonomy mutation rejected',code:'CSRF_REJECTED'});
 const deleted=await service.deleteTerm(params.taxonomy,params.slug,url.searchParams.get('locale')??'en');
 return json({success:true,data:deleted},{headers:{'cache-control':'private, no-store'}});
});
