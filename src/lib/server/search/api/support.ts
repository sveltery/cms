import {z} from 'zod';
import type {Kysely} from 'kysely';
import type {Database} from '../../database/lifecycle/upstream/database/types.ts';
import {InvalidCursorError} from '../../database/lifecycle/upstream/database/repositories/types.ts';
import type {ServerPrincipal} from '../../database/service.ts';
import {LOCALE_CODE_PATTERN} from '../i18n.ts';
export const localeCode=z.string().regex(LOCALE_CODE_PATTERN,'Invalid locale code');
export type SourceSearchRoute=(context:{url:URL;request:Request;locals:{emdash?:{db:Kysely<Database>;ensureSearchHealthy?:()=>Promise<void>};user:ServerPrincipal|null}})=>Promise<Response>;
export function hasPermission(user:ServerPrincipal|null,permission:string){return user?.permissions.some(value=>value===permission)??false;}
export function requirePerm(user:ServerPrincipal|null,permission:string){if(!user)return apiError('UNAUTHENTICATED','Authentication required',401);if(!hasPermission(user,permission))return apiError('INSUFFICIENT_PERMISSIONS','Insufficient permissions',403);return null;}
const headers={'cache-control':'private, no-store'};
export function apiError(code:string,message:string,status:number,details?:Record<string,unknown>){return Response.json({success:false,error:{code,message,...(details===undefined?{}:{details})}},{status,headers});}
export function apiSuccess<T>(data:T,status=200){return Response.json({success:true,data},{status,headers});}
export function handleError(error:unknown,fallbackMessage:string,fallbackCode:string){if(error instanceof InvalidCursorError)return apiError('INVALID_CURSOR',error.message,400);console.error(`[${fallbackCode}]`,error);return apiError(fallbackCode,fallbackMessage,500);}
