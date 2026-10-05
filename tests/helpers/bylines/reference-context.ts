/** Test transport only: untouched original controlled Role contexts. */
import {servicePrincipal} from '../../../src/lib/server/auth/composition.ts';
import type {SessionPrincipal} from '../../../src/lib/server/auth/roles.ts';
import type {BylineApiContext,BylineApiRoute} from '../../../src/lib/server/bylines/api-context.ts';
interface ReferenceContext extends Omit<BylineApiContext,'locals'> {locals:{emdash:BylineApiContext['locals']['emdash'];user:SessionPrincipal|null}}
export function referenceRoute(route:BylineApiRoute) {
 return (context:ReferenceContext)=>route({...context,locals:{...context.locals,user:servicePrincipal(context.locals.user)}});
}
