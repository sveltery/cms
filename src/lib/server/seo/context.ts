export interface SeoRequestContext {editMode?:boolean;db?:unknown;metrics?:{cacheHits:number;cacheMisses:number}}
export function runWithContext<T>(_context:SeoRequestContext,callback:()=>T):T{return callback();}
export function getRequestContext():SeoRequestContext|undefined{return undefined;}
