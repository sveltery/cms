import type { Kysely } from 'kysely';
import type { ServerPrincipal } from '../../../database/service.ts';
import type { Database } from '../database/types.ts';
import type { Storage } from '../storage/types.ts';
import type * as media from './handlers/media.ts';
export interface MediaRuntime {
  db:Kysely<Database>;storage?:Storage;config:{maxUploadSize?:number};
  handleMediaList:typeof media.handleMediaList extends (db:any,...args:infer Args)=>infer Result ? (...args:Args)=>Result : never;
  handleMediaGet:(id:string)=>ReturnType<typeof media.handleMediaGet>;
  handleMediaCreate:(input:Parameters<typeof media.handleMediaCreate>[1])=>ReturnType<typeof media.handleMediaCreate>;
  handleMediaUpdate:(id:string,input:Parameters<typeof media.handleMediaUpdate>[2])=>ReturnType<typeof media.handleMediaUpdate>;
  handleMediaDelete:(id:string)=>ReturnType<typeof media.handleMediaDelete>;
}
export interface MediaApiContext {
  request:Request;url:URL;params:Record<string,string|undefined>;
  locals:{emdash?:MediaRuntime;user:ServerPrincipal|null;tokenScopes?:string[]};
}
export type APIRoute=(context:MediaApiContext)=>Promise<Response>;
