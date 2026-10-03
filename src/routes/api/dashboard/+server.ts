import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {CmsError} from '$lib/server/database/contract';
import {requestDashboard} from '$lib/server/settings/dashboard/request';
const headers={'cache-control':'private, no-store'};
export const GET:RequestHandler=async()=>{
 try{return json({success:true,data:await requestDashboard()},{headers});}
 catch(cause){
  if(cause instanceof CmsError)return json({success:false,error:{code:cause.code==='FORBIDDEN'?'INSUFFICIENT_PERMISSIONS':cause.code,message:cause.message}},{status:cause.code==='UNAUTHENTICATED'?401:403,headers});
  return json({success:false,error:{code:'DASHBOARD_STATS_ERROR',message:'Failed to load dashboard statistics'}},{status:500,headers});
 }
};
