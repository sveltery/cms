// Test-only source-shaped route fixture. This is not an Astro/REST product surface.
import * as handlers from '../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts';
import {hasPermission} from '../../src/lib/server/auth/permissions.ts';
const route='__NATIVE_SOURCE_ROUTE__';
async function execute(method:string,context:any):Promise<Response>{
 const {params,locals,request}=context;const principal=locals.user;
 if(!principal)return Response.json({success:false,error:{code:'UNAUTHENTICATED',message:'Authentication required'}},{status:401});
 if(!hasPermission(principal,method==='GET'?'taxonomies:read':'taxonomies:manage'))return Response.json({success:false,error:{code:'INSUFFICIENT_PERMISSIONS',message:'Missing permission'}},{status:403});
 const db=locals.emdash?.db;if(!db)return Response.json({success:false,error:{code:'DATABASE_UNAVAILABLE'}},{status:503});
 const query=Object.fromEntries(new URL(request.url).searchParams),name=params.name;
 let result:any;
 if(method==='GET'&&route.endsWith('/translations.ts'))result=await handlers.handleTaxonomyDefTranslations(db,name,query);
 else if(method==='GET'&&route.endsWith('/terms/index.ts'))result=await handlers.handleTermList(db,name,{...query,includeCounts:query.includeCounts!=='false',resolveFallback:query.resolveFallback==='true'});
 else if(method==='GET')result=await handlers.handleTaxonomyGet(db,name,query);
 else if(method==='PUT')result=await handlers.handleTaxonomyUpdate(db,name,await request.json());
 else if(method==='DELETE')result=await handlers.handleTaxonomyDelete(db,name);
 else throw new Error('Source-shaped native route adapter not implemented for '+route);
 const status=result.success?200:result.error?.code==='NOT_FOUND'?404:result.error?.code==='CONFLICT'?409:400;
 return Response.json(result,{status});
}
export const GET=(context:any)=>execute('GET',context),PUT=(context:any)=>execute('PUT',context),DELETE=(context:any)=>execute('DELETE',context);
