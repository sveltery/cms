import {AsyncLocalStorage}from 'node:async_hooks';
/** Native rendering context. Each request owns an independent SEO cache. */
export interface SeoRequestContext {editMode?:boolean;db?:unknown;metrics?:{cacheHits:number;cacheMisses:number}}
const key=Symbol.for('sveltery:seo-request-context');
const globals=globalThis as Record<symbol,unknown>;
const storage=(globals[key] as AsyncLocalStorage<SeoRequestContext>|undefined)??new AsyncLocalStorage<SeoRequestContext>();
globals[key]=storage;
export function runWithContext<T>(context:SeoRequestContext,callback:()=>T):T{return storage.run(context,callback);}
export function getRequestContext():SeoRequestContext|undefined{return storage.getStore();}
