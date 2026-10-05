import type {Kysely} from 'kysely';
import type {Database} from './database-types.ts';
import type {ServerPrincipal} from '../database/service.ts';
import type {BylineSummary} from './repository-types.ts';
/** Only configured real pipeline callbacks are accepted; no fallback pipeline. */
export interface BylineHooks {
 hasHooks(name:'byline:afterDelete'):boolean;
 runBylineAfterSave(byline:BylineSummary,isNew:boolean):Promise<void>;
 runBylineAfterDelete(byline:BylineSummary):Promise<void>;
}
export interface BylineApiContext {
 request:Request;url:URL;params:Record<string,string|undefined>;
 locals:{emdash:{db:Kysely<Database>;hooks?:BylineHooks};user:ServerPrincipal|null};
}
export type BylineApiRoute=(context:BylineApiContext)=>Promise<Response>;
