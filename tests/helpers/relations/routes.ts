import { GET as list,POST as create } from '../../../src/routes/api/relations/+server.ts';
import { PATCH as patch } from '../../../src/routes/api/relations/[id]/+server.ts';
import { servicePrincipal } from '../../../src/lib/server/auth/composition.ts';
import type { RoleLevel } from '../../../src/lib/server/auth/roles.ts';
import { requireRelationDatabase } from '../../../src/lib/server/relations/storage.ts';
import type { Kysely } from 'kysely';

interface SourceContext {params:Record<string,string>;url:URL;request:Request;locals:{emdash:{db:object};user:{id:string;role:RoleLevel}}}
export function nativeContext(ctx:SourceContext){
  // Uniform original controlled unit context. No session/credential issuance.
  // Source header transport becomes the native configured Origin requirement.
  const headers=new Headers(ctx.request.headers);
  if(!['GET','HEAD','OPTIONS'].includes(ctx.request.method))headers.set('Origin',ctx.url.origin);
  const request=new Request(ctx.request,{headers});
  return {params:ctx.params,url:ctx.url,request,locals:{cms:{database:requireRelationDatabase(ctx.locals.emdash.db as Kysely<any>),
    principal:servicePrincipal(ctx.locals.user),mutationsEnabled:true},cmsRuntime:{publicOrigin:ctx.url.origin,basePath:'',rpName:'Original Source unit fixture'}}};
}
export const GET=(ctx:SourceContext)=>list(nativeContext(ctx) as Parameters<typeof list>[0]);
export const POST_SOURCE=(ctx:SourceContext)=>create(nativeContext(ctx) as Parameters<typeof create>[0]);
export { POST_SOURCE as POST };
export const PATCH_SOURCE=(ctx:SourceContext)=>patch(nativeContext(ctx) as Parameters<typeof patch>[0]);
export { PATCH_SOURCE as PATCH };
