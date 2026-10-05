// Compatibility API for the original SEO render host. The existing menus
// request context owns the sole ALS; this wrapper preserves caller identity.
import {runWithContext as sharedRunWithContext,getRequestContext as sharedGetRequestContext,type RequestContext} from '../menus/context.ts';
export interface SeoRequestContext {editMode?:boolean;db?:unknown;metrics?:{cacheHits:number;cacheMisses:number}}
export function runWithContext<T>(context:SeoRequestContext,callback:()=>T):T {
 return sharedRunWithContext(context as unknown as RequestContext,callback);
}
export function getRequestContext():SeoRequestContext|undefined{return sharedGetRequestContext();}
