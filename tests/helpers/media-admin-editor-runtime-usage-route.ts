// Original controlled Source Role fixture -> the actual Native API route owner.
import type {APIRoute,MediaRuntime} from '../../src/lib/server/general-media/upstream/api/context.ts';
import type {SessionPrincipal} from '../../src/lib/server/auth/roles.ts';
import {referenceRoute} from './general-media/reference-context.ts';
const modules=import.meta.glob('../../src/lib/server/media-admin/api/media/_id_/usage.ts',{eager:true});
const actual=modules['../../src/lib/server/media-admin/api/media/_id_/usage.ts'] as {GET?:APIRoute}|undefined;
if(typeof actual?.GET!=='function')throw new Error('Actual qualified usage GET route is unavailable');
const inheritedRoute=referenceRoute(actual.GET);
// The whole Original cases deliberately supply only db, or an empty runtime,
// before authorization/configuration checks. This is a type boundary only.
export interface UsageReadReferenceContext {
 request:Request;params?:Record<string,string|undefined>;
 locals:{emdash?:Partial<MediaRuntime>;user?:SessionPrincipal|null;tokenScopes?:string[]};
}
export function GET(context:UsageReadReferenceContext):Promise<Response> {
 return inheritedRoute(context as unknown as Parameters<typeof inheritedRoute>[0]);
}
