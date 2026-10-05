// Source SeoRepository upsert/delete/copy algorithms at immutable EmDash1.1.0
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright2026 Cloudflare Inc.
// MIT; notices/emdash-MIT.txt. Plans compile only; the content owner executes.
import {sql,type CompiledQuery,type Kysely} from 'kysely';
import type {ContentSeo,ContentSeoInput} from '../../seo/types.ts';
import type {Database} from './types.ts';
import {NATIVE_SEO_STORAGE,seoStorage,type SeoStorage} from './storage.ts';

export function hasSeoFields(input:ContentSeoInput|undefined):boolean {
 return input!==undefined&&(input.title!==undefined||input.description!==undefined||input.image!==undefined||input.canonical!==undefined||input.noIndex!==undefined);
}
export function seoUpsertStatements(db:Kysely<Database>,collection:string,id:string,input:ContentSeoInput,descriptor:SeoStorage=NATIVE_SEO_STORAGE):readonly CompiledQuery[] {
 const storage=seoStorage(descriptor);
 if(!hasSeoFields(input))return [];
 const now=new Date().toISOString();
 return [sql`
  INSERT INTO ${sql.table(storage.seo)} (
   collection,content_id,seo_title,seo_description,seo_image,seo_canonical,seo_no_index,created_at,updated_at
  ) VALUES (
   ${collection},${id},${input.title??null},${input.description??null},${input.image??null},${input.canonical??null},${input.noIndex?1:0},${now},${now}
  ) ON CONFLICT (collection,content_id) DO UPDATE SET
   seo_title=${input.title!==undefined?sql`${input.title}`:sql.ref(storage.seo+'.seo_title')},
   seo_description=${input.description!==undefined?sql`${input.description}`:sql.ref(storage.seo+'.seo_description')},
   seo_image=${input.image!==undefined?sql`${input.image}`:sql.ref(storage.seo+'.seo_image')},
   seo_canonical=${input.canonical!==undefined?sql`${input.canonical}`:sql.ref(storage.seo+'.seo_canonical')},
   seo_no_index=${input.noIndex!==undefined?sql`${input.noIndex?1:0}`:sql.ref(storage.seo+'.seo_no_index')},
   updated_at=${now}
 `.compile(db)];
}
export function seoDeleteStatements(db:Kysely<Database>,collection:string,id:string,descriptor:SeoStorage=NATIVE_SEO_STORAGE):readonly CompiledQuery[] {
 const storage=seoStorage(descriptor);
 return [db.deleteFrom(storage.seo).where('collection','=',collection).where('content_id','=',id).compile()];
}
export function seoCopyStatements(db:Kysely<Database>,collection:string,targetId:string,source:ContentSeo,descriptor:SeoStorage=NATIVE_SEO_STORAGE):readonly CompiledQuery[] {
 if(source.title===null&&source.description===null&&source.image===null&&!source.noIndex)return [];
 return seoUpsertStatements(db,collection,targetId,{title:source.title,description:source.description,image:source.image,canonical:null,noIndex:source.noIndex},descriptor);
}
/** The existing collection cache is invalidated only after the owner commits. */
export async function completeContentSeo(collection:string,wrote:boolean):Promise<void> {
 if(wrote){const {invalidateCollectionCache}=await import('../menus/object-cache.ts');invalidateCollectionCache(collection);}
}
