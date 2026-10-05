// Only the original controlled-role fixture bridge; no session or identity minting.
import { servicePrincipal } from '../../../src/lib/server/auth/composition.ts';
import type { SessionPrincipal } from '../../../src/lib/server/auth/roles.ts';
import type { APIRoute, MediaRuntime } from '../../../src/lib/server/general-media/upstream/api/context.ts';
export interface ReferenceContext {request:Request;params?:Record<string,string|undefined>;locals:{emdash?:MediaRuntime;user?:SessionPrincipal;tokenScopes?:string[]}}
export function referenceRoute(route:APIRoute) {
  return (context:ReferenceContext)=>route({request:context.request,url:new URL(context.request.url),params:context.params??{},locals:{...context.locals,user:servicePrincipal(context.locals.user??null)}});
}
