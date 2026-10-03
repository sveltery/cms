// Native storage adaptation of pinned EmDash settings/index.ts; MIT 2026 Cloudflare Inc.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; notices/emdash-MIT.txt.
import {sql,type Kysely,type CompiledQuery} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {OptionsRepository} from './options.ts';
import type {SettingsTables} from './tables.ts';
import type {SiteSettings,SiteSettingsUpdate,SiteSettingKey,MediaReference} from './types.ts';
const adapters=new WeakMap<object,CmsDatabase>();
export function settingsDb(database:CmsDatabase):Kysely<SettingsTables> {
 const db=database.db as unknown as Kysely<SettingsTables>;adapters.set(db,database);return db;
}
async function resolveMediaReference(reference:MediaReference|undefined,db:Kysely<SettingsTables>):Promise<MediaReference|undefined>{
 if(!reference?.mediaId)return reference;
 try {
  const media=(await sql<{storage_key:string;mime_type:string;width:number|null;height:number|null}>`SELECT storage_key,mime_type,width,height FROM media WHERE id=${reference.mediaId}`.execute(db)).rows[0];
  if(media)return {...reference,url:`/_emdash/api/media/file/${media.storage_key}`,contentType:media.mime_type,
   ...(media.width!==null?{width:media.width}:{}),...(media.height!==null?{height:media.height}:{})};
 }catch{/* Pinned resolver preserves an orphaned reference on missing media or repository failure. */}
 return reference;
}
export async function getSiteSettingsWithDb(db:Kysely<SettingsTables>,_storage:unknown=null):Promise<Partial<SiteSettings>>{
 const options=await new OptionsRepository(db).getByPrefix('site:');
 const settings=Object.fromEntries([...options].map(([key,value])=>[key.replace('site:',''),value])) as Partial<SiteSettings>;
 if(settings.logo)settings.logo=await resolveMediaReference(settings.logo,db);
 if(settings.favicon)settings.favicon=await resolveMediaReference(settings.favicon,db);
 if(settings.seo?.defaultOgImage)settings.seo={...settings.seo,defaultOgImage:await resolveMediaReference(settings.seo.defaultOgImage,db)};
 return settings;
}
export async function getSiteSettingWithDb<K extends SiteSettingKey>(key:K,db:Kysely<SettingsTables>,_storage:unknown=null):Promise<SiteSettings[K]|undefined>{
 const value=await new OptionsRepository(db).get<SiteSettings[K]>(`site:${key}`);
 if(!value)return undefined;
 if((key==='logo'||key==='favicon')&&typeof value==='object'&&'mediaId' in value)return await resolveMediaReference(value as MediaReference,db) as SiteSettings[K];
 if(key==='seo'&&typeof value==='object'){
  const seo=value as SiteSettings['seo'];
  if(seo?.defaultOgImage)return {...seo,defaultOgImage:await resolveMediaReference(seo.defaultOgImage,db)} as SiteSettings[K];
 }
 return value;
}
const nestedKeys=new Set(['seo','social']);
const caches=new WeakMap<object,Partial<SiteSettings>>();
export function invalidateSiteSettingsCache(db?:Kysely<SettingsTables>){if(db)caches.delete(db);}
/** Pinned nested merge/deletion semantics, executed through the adapter's guarded atomic batch. */
export async function setSiteSettings(settings:SiteSettingsUpdate,db:Kysely<SettingsTables>):Promise<void>{
 const database=adapters.get(db);if(!database)throw new Error('Settings require the registered CMS database adapter');
 try{
  for(let attempt=0;attempt<4;attempt++){
   const statements:CompiledQuery[]=[];const guards:CompiledQuery[]=[];
   const token=`settings-${crypto.randomUUID()}`;
   for(const [key,value] of Object.entries(settings)){
    if(value===undefined)continue;
    const name=`site:${key}`;
    let next:unknown=value;
    if(value!==null&&nestedKeys.has(key)&&typeof value==='object'&&!Array.isArray(value)){
     const previous=await new OptionsRepository(db).getVersioned<Record<string,unknown>>(name);
     guards.push(sql`INSERT INTO _cms_guards(token,pass) SELECT ${`${token}-${key}`},CASE WHEN
       ${previous?sql`EXISTS(SELECT 1 FROM options WHERE name=${name} AND revision=${previous.revision})`:sql`NOT EXISTS(SELECT 1 FROM options WHERE name=${name})`} THEN 1 ELSE 0 END`.compile(db));
     const record={...previous?.value};
     for(const [field,fieldValue] of Object.entries(value)){
      if(fieldValue===null)delete record[field];else if(fieldValue!==undefined)Object.defineProperty(record,field,{value:fieldValue,enumerable:true,writable:true,configurable:true});
     }
     next=Object.keys(record).length?record:null;
    }
    if(next===null)statements.push(db.deleteFrom('options').where('name','=',name).compile());
    else statements.push(db.insertInto('options').values({name,value:JSON.stringify(next),revision:crypto.randomUUID()})
     .onConflict(oc=>oc.column('name').doUpdateSet(eb=>({value:eb.ref('excluded.value'),revision:eb.ref('excluded.revision')}))).compile());
   }
   try{
    await database.atomicBatch([...guards,...statements,
     sql`DELETE FROM _cms_guards WHERE token LIKE ${`${token}-%`}`.compile(db)]);return;
   }catch(cause){
    if(attempt<3&&cause instanceof Error&&cause.message.includes('CHECK constraint failed: pass = 1'))continue;
    throw cause;
   }
  }
 }finally{invalidateSiteSettingsCache(db);}
}
