// Native storage adaptation of pinned EmDash settings/index.ts; MIT 2026 Cloudflare Inc.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; notices/emdash-MIT.txt.
import {resolvePluginEncryptionKeys} from "./vendor/encryption-keys.ts";
import {PluginSettingEncryptionError,decryptPluginSetting,isEncryptedPluginSetting} from "./vendor/plugin-settings.ts";
import {sql,type Kysely,type CompiledQuery} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {singleFlightCached} from './vendor/single-flight-cache.ts';
import {siteCache,invalidateSiteSettingsCache} from './cache.ts';
export {invalidateSiteSettingsCache} from './cache.ts';
import {requestCached,peekRequestCache} from './vendor/request-cache.ts';
import {getSettingsContext} from './context.ts';
import {OptionsRepository} from './options.ts';
import type {SettingsTables} from './tables.ts';
import type {SiteSettings,SiteSettingsUpdate,SiteSettingKey,MediaReference} from './types.ts';
const adapters=new WeakMap<object,CmsDatabase>();
export function settingsDb(database:CmsDatabase,override?:Kysely<SettingsTables>):Kysely<SettingsTables> {
 const db=override??database.db as unknown as Kysely<SettingsTables>;adapters.set(db,database);return db;
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
class PlannedOptions extends OptionsRepository {
 private readonly databaseDb:Kysely<SettingsTables>;
 readonly statements:CompiledQuery[]=[];
 constructor(databaseDb:Kysely<SettingsTables>){
  super(databaseDb);
  this.databaseDb=databaseDb;
 }
 override async set(name:string,value:unknown):Promise<void>{
  this.statements.push(this.databaseDb.insertInto('options').values({name,value:JSON.stringify(value),revision:crypto.randomUUID()})
   .onConflict(oc=>oc.column('name').doUpdateSet(eb=>({value:eb.ref('excluded.value'),revision:eb.ref('excluded.revision')}))).compile());
 }
 override async delete(name:string):Promise<boolean>{this.statements.push(this.databaseDb.deleteFrom('options').where('name','=',name).compile());return true;}
 override async deleteMany(names:string[]):Promise<number>{if(names.length)this.statements.push(this.databaseDb.deleteFrom('options').where('name','in',names).compile());return names.length;}
}
/** Pinned nested merge/deletion semantics, executed through the adapter's guarded atomic batch. */
export async function setSiteSettings(settings:SiteSettingsUpdate,db:Kysely<SettingsTables>):Promise<void>{
 const database=adapters.get(db);if(!database)throw new Error('Settings require the registered CMS database adapter');
 try{
  for(let attempt=0;attempt<4;attempt++){
   const transactionOptions=new PlannedOptions(db);const guards:CompiledQuery[]=[];
   const updates:Record<string,unknown>={};const deletions:string[]=[];const nestedPatches:Array<[string,Record<string,unknown>]>=[];
   const token=`settings-${crypto.randomUUID()}`;
   for(const [key,value]of Object.entries(settings)){
    if(value===undefined)continue;
    if(value===null)deletions.push(`site:${key}`);
    else if(nestedKeys.has(key)&&typeof value==='object'&&!Array.isArray(value))nestedPatches.push([key,value as Record<string,unknown>]);
    else updates[`site:${key}`]=value;
   }
   await transactionOptions.setMany(updates);await transactionOptions.deleteMany(deletions);
   for(const [key,patch]of nestedPatches){
    const name=`site:${key}`;
    const previous=await transactionOptions.getVersioned<Record<string,unknown>>(name);
    guards.push(sql`INSERT INTO _cms_guards(token,pass) SELECT ${`${token}-${key}`},CASE WHEN
     ${previous?sql`EXISTS(SELECT 1 FROM options WHERE name=${name} AND revision=${previous.revision})`:sql`NOT EXISTS(SELECT 1 FROM options WHERE name=${name})`} THEN 1 ELSE 0 END`.compile(db));
    const next={...previous?.value};
    for(const [field,fieldValue]of Object.entries(patch)){
     if(fieldValue===null)delete next[field];else if(fieldValue!==undefined)next[field]=fieldValue;
    }
    if(Object.keys(next).length===0)await transactionOptions.delete(name);else await transactionOptions.set(name,next);
   }
   try{
    await database.atomicBatch([...guards,...transactionOptions.statements,
     sql`DELETE FROM _cms_guards WHERE token LIKE ${`${token}-%`}`.compile(db)]);return;
   }catch(cause){
    if(attempt<3&&cause instanceof Error&&cause.message.includes('CHECK constraint failed: pass = 1'))continue;
    throw cause;
   }
  }
 }finally{invalidateSiteSettingsCache(db);}
}
/** Public server rendering helpers consume only the trusted render context. */
export function getSiteSettings():Promise<Partial<SiteSettings>>{
 const context=getSettingsContext();if(!context)throw new Error('No configured site settings render context');
 return requestCached('siteSettings',()=>singleFlightCached(siteCache(context.db),()=>getSiteSettingsWithDb(context.db),
  {anchor:promise=>context.keepAlive?.(promise),ownerTimeoutMs:30_000}));
}
export async function getSiteSetting<K extends SiteSettingKey>(key:K):Promise<SiteSettings[K]|undefined>{
 const primed=peekRequestCache<Partial<SiteSettings>>('siteSettings');if(primed)return(await primed)[key];
 const context=getSettingsContext();if(!context)throw new Error('No configured site settings render context');
 return requestCached(`siteSetting:${key}`,()=>getSiteSettingWithDb(key,context.db));
}



function isPluginSettingEnvelopeRecord(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		"$emdash" in value &&
		value.$emdash === "plugin-setting"
	);
}


async function decodePersistedPluginSetting(
	pluginId: string,
	key: string,
	value: unknown,
	encryptionKeys?: Awaited<ReturnType<typeof resolvePluginEncryptionKeys>>,
): Promise<unknown> {
	if (isEncryptedPluginSetting(value)) {
		return decryptPluginSetting(pluginId, key, value, encryptionKeys);
	}
	if (isPluginSettingEnvelopeRecord(value)) {
		throw new PluginSettingEncryptionError(
			"PLUGIN_SETTING_DECRYPTION_FAILED",
			"Plugin secret setting has an invalid encrypted envelope",
		);
	}
	return value;
}


/**
 * Get a single plugin setting by key (with explicit db).
 *
 * @internal Use `getPluginSetting()` in templates and plugin rendering code.
 */
export async function getPluginSettingWithDb<T = unknown>(
	pluginId: string,
	key: string,
	db: Kysely<SettingsTables>,
): Promise<T | undefined> {
	const options = new OptionsRepository(db);
	const value = await options.get(`plugin:${pluginId}:settings:${key}`);
	if (value === null) return undefined;
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- caller supplies the expected plugin setting type
	return (await decodePersistedPluginSetting(pluginId, key, value)) as T;
}


/**
 * Get all persisted plugin settings for a plugin (with explicit db).
 *
 * @internal Use `getPluginSettings()` in templates and plugin rendering code.
 */
export async function getPluginSettingsWithDb(
	pluginId: string,
	db: Kysely<SettingsTables>,
): Promise<Record<string, unknown>> {
	const prefix = `plugin:${pluginId}:settings:`;
	const options = new OptionsRepository(db);
	const allOptions = await options.getByPrefix(prefix);

	const entries = [...allOptions].filter(([key]) => key.startsWith(prefix));
	const encryptionKeys = entries.some(([, value]) => isEncryptedPluginSetting(value))
		? await resolvePluginEncryptionKeys()
		: undefined;
	return Object.fromEntries(
		await Promise.all(
			entries.map(async ([storedKey, value]) => {
				const key = storedKey.slice(prefix.length);
				return [
					key,
					await decodePersistedPluginSetting(pluginId, key, value, encryptionKeys),
				] as const;
			}),
		),
	);
}
