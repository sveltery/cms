// Native fixed-statement seeding adapter for EmDash1.1.0 seed/apply.ts.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Exact authority913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; no whole applySeed credit.
import {sql,type Kysely,type KyselyPlugin,type PluginTransformQueryArgs,type PluginTransformResultArgs,type QueryResult,type RootOperationNode,type UnknownRow} from 'kysely';
import {ulid} from 'ulidx';
import type {CmsDatabase} from '../database/contract.ts';
import {SchemaRegistry} from '../database/registry.ts';
import {serializeValue} from '../database/field-value.ts';
import {tableName,identifier,parse} from '../database/validation.ts';
import {ContentRepository} from '../database/lifecycle/upstream/database/repositories/content.ts';
import {ContentDatetimeNormalizer,type DatetimeContextCache} from '../database/lifecycle/upstream/database/content-datetime.ts';
import {createRevisionId} from '../database/lifecycle/upstream/database/repositories/revision.ts';
import {registerLifecycleDatabase} from '../database/lifecycle/upstream/host.ts';
import {getSiteSettingWithDb,setSiteSettings,settingsDb} from '../settings/index.ts';
import type {SeedFile,SeedApplyResult,SeedTaxonomy,SeedContentEntry} from './upstream/types.ts';
import {BlockTypeRegistry} from '../blocks/registry.ts';
import {blocksDatabase} from '../blocks/host.ts';
import {normalizeBlocksData} from '../blocks/values.ts';
export interface SetupSeedDependencies {
 applyTaxonomies?: (database:CmsDatabase,definitions:readonly SeedTaxonomy[],onConflict:'skip')=>Promise<{created:number;skipped:number}>;
 enableSearch?: (database:CmsDatabase,collection:string)=>Promise<unknown>;
}
export class SetupSeedError extends Error {constructor(message:string){super(message);this.name='SetupSeedError';}}
/** The same pinned per-query threshold; each item that crosses it finishes. */
class SeedBudget implements KyselyPlugin {
 #queries=0;
 transformQuery(args:PluginTransformQueryArgs):RootOperationNode{this.#queries++;return args.node;}
 transformResult(args:PluginTransformResultArgs):Promise<QueryResult<UnknownRow>>{return Promise.resolve(args.result);}
 isSpent(){return this.#queries>=500;}
}
function assertSupportedSeed(seed:SeedFile){
 if(!seed||seed.version!=='1')throw new SetupSeedError('Invalid seed version');
 // Feature integrations are explicit, rather than silently losing trusted seed data.
 for(const family of ['relations','menus','redirects','widgetAreas','sections','bylines'] as const)
  if(seed[family]?.length)throw new SetupSeedError(`Seed ${family} requires its real provider`);
 for(const [type,entries]of Object.entries(seed.content??{})) {
  parse(identifier,type);
  for(const entry of entries){
   if(!entry||typeof entry.id!=='string'||!entry.data||typeof entry.data!=='object'||Array.isArray(entry.data))throw new SetupSeedError('Invalid seed content');
   for(const field of ['taxonomies','bylines','translationOf'] as const)if(entry[field]!==undefined)throw new SetupSeedError(`Seed content ${field} requires its real provider`);
  }
 }
}
/** Create row, initial live revision, promotion and prune intent in one adapter batch. */
async function createSeedContent(database:CmsDatabase,type:string,entry:SeedContentEntry,locale:string,datetimes:ContentDatetimeNormalizer,routable:boolean){
 const db=database.db,slug=typeof entry.slug==='string'&&entry.slug.trim().length>0?entry.slug:null;
 const status=entry.status||'published';
 if(status==='published'&&routable&&!slug)throw new SetupSeedError('Cannot publish routable content without a slug');
 const collection=await new SchemaRegistry(database).getCollectionWithFields(type);
 if(!collection)throw new SetupSeedError(`Unknown seed collection '${type}'`);
 const blocks=await normalizeBlocksData(blocksDatabase(database),collection as any,entry.data,{}, {restoreBlocks:true},false);
 const data=await datetimes.normalizeInput(type,blocks);
 // Bound reference fields are storage-less and need a relation-edge provider.
 const writable=await datetimes.writableFieldSlugs(type);
 for(const field of Object.keys(data))if(!writable.has(field))throw new SetupSeedError(`Seed field '${field}' is not a writable field`);
 const id=slug?ulid():entry.id,now=new Date().toISOString(),name=tableName(type);
 const columns=['id','slug','status','author_id','primary_byline_id','created_at','updated_at','published_at','version','locale','translation_group',...Object.keys(data)];
 const values=[id,slug,status,null,null,now,now,status==='published'?now:null,1,locale,id,...Object.values(data).map(serializeValue)];
 const statements=[sql`INSERT INTO ${sql.ref(name)} (${sql.join(columns.map(column=>sql.ref(column)))}) VALUES (${sql.join(values.map(value=>sql`${value}`))})`.compile(db)];
 if(status==='published'){
  const revisionId=createRevisionId();
  // Source publication snapshots ContentRepository.mapRow after SQLite stores
  // defaults/affinities, omits nulls and decodes object/array-shaped strings.
  const storedFields=[...writable];
  const rawData=storedFields.length?sql`json_object(${sql.join(storedFields.flatMap(field=>[sql`${field}`,sql.ref(field)]))})`:sql`'{}'`;
  const snapshot=sql`(SELECT json_group_object(key,CASE WHEN type='text' AND substr(value,1,1) IN ('{','[') AND json_valid(value) THEN json(value) ELSE value END) FROM json_each(${rawData}) WHERE type!='null')`;
  statements.push(sql`INSERT INTO _cms_revisions(id,collection,entry_id,data,author_id,created_at) SELECT ${revisionId},${type},${id},${snapshot},NULL,${now} FROM ${sql.ref(name)} WHERE id=${id}`.compile(db));
  statements.push(sql`UPDATE ${sql.ref(name)} SET live_revision_id=${revisionId},draft_revision_id=NULL,status='published',scheduled_at=NULL,published_at=${now},updated_at=${now},version=version+1 WHERE id=${id}`.compile(db));
  statements.push(sql`INSERT INTO _cms_revision_prune_queue(collection,entry_id,revision_id) VALUES(${type},${id},${revisionId}) ON CONFLICT(collection,entry_id) DO UPDATE SET revision_id=excluded.revision_id`.compile(db));
 }
 await database.atomicBatch(statements);
 return id;
}
export async function applySetupSeed(database:CmsDatabase,seed:SeedFile,includeContent:boolean,dependencies:SetupSeedDependencies={},options:{onConflict?:'skip'|'error'|'update'}={}) {
 assertSupportedSeed(seed);
 if(seed.taxonomies?.length&&!dependencies.applyTaxonomies)throw new SetupSeedError('Taxonomy seed provider is not configured');
 if(seed.collections?.some(collection=>collection.supports?.includes('search'))&&!dependencies.enableSearch)throw new SetupSeedError('Search seed provider is not configured');
 const budget=new SeedBudget(),db=database.db.withPlugin(budget);
 const counted:CmsDatabase={db,atomicBatch:database.atomicBatch.bind(database),close:database.close.bind(database)};
 const siteDb=settingsDb(counted);registerLifecycleDatabase(counted,{timezone:()=>getSiteSettingWithDb('timezone',siteDb)});
 const registry=new SchemaRegistry(counted),content=new ContentRepository(db as any),contexts:DatetimeContextCache=new Map(),datetimes=new ContentDatetimeNormalizer(db as any,contexts);
 const result:SeedApplyResult={blockTypes:{created:0,skipped:0,updated:0},collections:{created:0,skipped:0,updated:0},fields:{created:0,skipped:0,updated:0},relations:{created:0,skipped:0,updated:0},taxonomies:{created:0,skipped:0,terms:0},bylines:{created:0,skipped:0,updated:0},menus:{created:0,items:0},redirects:{created:0,skipped:0,updated:0},widgetAreas:{created:0,widgets:0},sections:{created:0,skipped:0,updated:0},settings:{applied:0},content:{created:0,skipped:0,updated:0},media:{created:0,skipped:0}};
 if(seed.settings){await setSiteSettings(seed.settings,siteDb);result.settings.applied=Object.values(seed.settings).filter(value=>value!==undefined).length;}
 // Complete pinned blockTypes application loop (seed/apply.ts:373–382).
 if(seed.blockTypes){const blockRegistry=new BlockTypeRegistry(blocksDatabase(counted)),onConflict=options.onConflict??'skip';for(const blockType of seed.blockTypes){const existing=await blockRegistry.getBlockType(blockType.slug);await blockRegistry.applySeedBlockType(blockType,onConflict);if(!existing)result.blockTypes.created++;else if(onConflict==='update')result.blockTypes.updated++;else result.blockTypes.skipped++;}}
 for(const definition of seed.collections??[]){
  const {fields:declaredFields,titleField,dateField,...seedMetadata}=definition;
  const metadata=Object.fromEntries(Object.entries(seedMetadata).filter(([,value])=>value!==undefined));
  let collection=await registry.getCollection(definition.slug);
  if(collection)result.collections.skipped++;
  else{
   collection=await registry.createCollection({...metadata,supports:definition.supports??[],source:'seed'});result.collections.created++;
  }
  for(const field of definition.fields??[]){
   if(await registry.getField(definition.slug,field.slug)){result.fields.skipped++;continue;}
   await registry.createField(definition.slug,field);result.fields.created++;
  }
  if(titleField!==undefined||dateField!==undefined)await registry.updateCollection(definition.slug,{...(titleField!==undefined?{titleField}:{}),...(dateField!==undefined?{dateField}:{})});
 }
 if(seed.taxonomies?.length){const receipt=await dependencies.applyTaxonomies!(counted,seed.taxonomies,'skip');result.taxonomies.created=receipt.created;result.taxonomies.skipped=receipt.skipped;}
 const total=includeContent?Object.values(seed.content??{}).reduce((count,entries)=>count+entries.length,0):0;
 const progress={done:0,total};let complete=true;
 if(includeContent)outer:for(const [type,entries]of Object.entries(seed.content??{})){
  const collection=await registry.getCollection(type);if(!collection)throw new SetupSeedError(`Unknown seed collection '${type}'`);
  for(const entry of entries){
   const locale=entry.locale??seed.defaultLocale??'en';
   const existing=entry.slug?await content.findBySlugIncludingTrashed(type,entry.slug,locale):await content.findById(type,entry.id);
   if(existing){result.content.skipped++;progress.done++;continue;}
   if(result.content.created>0&&budget.isSpent()){complete=false;break outer;}
   await createSeedContent(counted,type,entry,locale,datetimes,collection.routable);result.content.created++;progress.done++;
  }
 }
 if(complete)for(const collection of seed.collections??[]){
  if(collection.supports?.includes('search')&&collection.fields.some(field=>field.searchable))await dependencies.enableSearch!(counted,collection.slug);
 }
 return {result,complete,progress};
}
