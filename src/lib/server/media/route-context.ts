import type {NativeMediaRuntime} from './runtime.ts';
import type {RoleLevel} from './source/auth/types.ts';
/** Minimal native context consumed by complete pinned route bodies. */
export interface APIContext {
 request:Request;params:Record<string,string|undefined>;url?:URL;
 locals:{emdash?:NativeMediaRuntime;user?:{id:string;role:RoleLevel}|null;tokenScopes?:string[]};
}
export type APIRoute=(context:APIContext)=>Promise<Response>;
