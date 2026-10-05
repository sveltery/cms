// Source content.ts hydrateSeo/hydrateSeoMany, immutable EmDash1.1.0.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type {CmsDatabase} from '../database/contract.ts';
import type {ContentItem} from '../database/lifecycle/upstream/database/repositories/types.ts';
import type {Database} from './types.ts';
export async function hydrateContentSeo<T extends ContentItem>(database:CmsDatabase,collection:string,item:T,hasSeo:boolean):Promise<T> {
 if(!hasSeo)return item;
 const {SeoRepository}=await import('./repository.ts');
 const repository=new SeoRepository(database.db as unknown as import('kysely').Kysely<Database>);
 return {...item,seo:await repository.get(collection,item.id)};
}
export async function hydrateContentSeoMany<T extends ContentItem>(database:CmsDatabase,collection:string,items:T[],hasSeo:boolean):Promise<T[]> {
 if(!hasSeo||!items.length)return items;
 const {SeoRepository}=await import('./repository.ts');
 const repository=new SeoRepository(database.db as unknown as import('kysely').Kysely<Database>);
 const seo=await repository.getMany(collection,items.map(item=>item.id));
 return items.map(item=>({...item,seo:seo.get(item.id)}));
}
