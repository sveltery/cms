import type {ContentSeo}from '../../seo/types.ts';
export function primeSeoPanel(_collection:string,_id:string,_seo:ContentSeo):void{}
export async function peekSeoPanel(_collection:string,_id:string):Promise<ContentSeo|null>{return null;}
