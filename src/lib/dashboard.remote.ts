import {query} from '$app/server';
import {error} from '@sveltejs/kit';
import {CmsError} from '$lib/server/database/contract';
import {requestDashboard} from '$lib/server/settings/dashboard/request';
export const getDashboardStats=query(async()=>{
 try{return await requestDashboard();}
 catch(cause){if(cause instanceof CmsError)error(cause.code==='UNAUTHENTICATED'?401:403,{code:cause.code,message:cause.message});error(500,{code:'DASHBOARD_STATS_ERROR',message:'Failed to load dashboard statistics'});}
});
