// Native host descriptor. Cache is opt-in; no Astro virtual module is installed.
import {getRequestContext} from './request-context.ts';
export const createObjectCache=undefined;
export const objectCacheConfig=undefined;
export const i18n=undefined;
export function waitUntil(task:Promise<unknown>):void {(getRequestContext() as any)?.keepAlive?.(task);}
