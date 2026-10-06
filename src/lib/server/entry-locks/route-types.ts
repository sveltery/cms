import type {CmsDatabase} from '../database/contract.ts';
import type {ServerPrincipal} from '../database/service.ts';
import type {ApiResult} from './result.ts';
export interface EntryLockRouteLocals {
 emdash:{db:CmsDatabase;handleContentGet(collection:string,id:string,locale?:string):Promise<ApiResult<unknown>>};
 user:ServerPrincipal|null;
}
export type EntryLockAPIRoute=(event:{params:{collection?:string;id?:string};locals:EntryLockRouteLocals;url:URL;request:Request})=>Promise<Response>;
