import {sql} from 'kysely';
import {ulid} from 'ulidx';
import {CmsError,type CmsDatabase} from '../database/contract.ts';
import type {ServerPrincipal} from '../database/service.ts';
import {parse,identifier,entryId,localeInput,tableName} from '../database/validation.ts';
import {SchemaRegistry} from '../database/registry.ts';
import {ContentRepository} from './upstream/database/repositories/content.ts';
import {TaxonomyRepository} from './upstream/database/repositories/taxonomy.ts';
import {registerTaxonomyDatabase} from './upstream/host.ts';
import {runWithContext} from './upstream/request-context.ts';
import {getTaxonomyDefs} from './upstream/taxonomies/index.ts';
import {getI18nConfig} from './upstream/i18n/config.ts';
import {assignmentResponse} from './upstream/astro/routes/api/content/[collection]/[id]/terms/[taxonomy].ts';
import {entryTaxonomyPlan} from './content-plan.ts';
import * as handlers from './upstream/api/handlers/taxonomies.ts';
import * as schemas from './upstream/api/schemas/taxonomies.ts';
import {handleBulkTag} from './upstream/api/handlers/bulk-tag.ts';
import type {ApiResult} from './upstream/api/types.ts';

export class TaxonomyError extends Error {readonly code:string;constructor(code:string,message:string){super(message);this.code=code;this.name='TaxonomyError';}}
function result<T>(value:ApiResult<T>):T{if(!value.success)throw new TaxonomyError(value.error?.code??'TAXONOMY_ERROR',value.error?.message??'Taxonomy operation failed');return value.data!;}
function validated<T>(schema:{safeParse(value:unknown):{success:boolean;data?:T}},value:unknown):T{const parsed=schema.safeParse(value);if(!parsed.success)throw new CmsError('VALIDATION_ERROR');return parsed.data!;}
export interface EntryTaxonomyKey {collection:string;id:string;locale?:string}
/** Only trusted server principals compose this API. Inputs never carry identity. */
export function taxonomyService(database:CmsDatabase,principal:ServerPrincipal|null){
 const identity=principal&&typeof principal.id==='string'&&principal.id.length>0&&principal.id.length<=128&&Array.isArray(principal.permissions)?{id:principal.id,permissions:new Set<string>(principal.permissions)}:null;
 function permission(...permissions:string[]){if(!identity)throw new CmsError('UNAUTHENTICATED');if(!permissions.some(value=>identity.permissions.has(value)))throw new CmsError('FORBIDDEN');return identity;}
 function run<T>(required:string[],operation:()=>Promise<T>,locale?:string):Promise<T>{permission(...required);registerTaxonomyDatabase(database);return runWithContext({editMode:false,db:database.db,dbIsIsolated:true,locale},operation);}
 function name(value:unknown){return parse(identifier,value);}
 function key(value:EntryTaxonomyKey){return{collection:parse(identifier,value.collection),id:parse(entryId,value.id),locale:parse(localeInput,value.locale??getI18nConfig()?.defaultLocale??'en')};}
 async function entry(value:ReturnType<typeof key>){const item=await new ContentRepository(database.db as any).findById(value.collection,value.id);if(!item||item.locale!==value.locale)throw new CmsError('NOT_FOUND');return item;}
 return{
  listDefinitions:(locale?:string)=>run(['taxonomies:read'],async()=>result(await handlers.handleTaxonomyList(database.db as any,{locale})),locale),
  getDefinition:(taxonomy:string,locale?:string)=>run(['taxonomies:read'],async()=>result(await handlers.handleTaxonomyGet(database.db as any,name(taxonomy),{locale})),locale),
  definitionTranslations:(taxonomy:string)=>run(['taxonomies:read'],async()=>result(await handlers.handleTaxonomyDefTranslations(database.db as any,name(taxonomy)))),
  collections:()=>run(['taxonomies:manage'],()=>new SchemaRegistry(database).listCollections()),
  createDefinition:(input:unknown)=>run(['taxonomies:manage'],async()=>result(await handlers.handleTaxonomyCreate(database.db as any,validated(schemas.createTaxonomyDefBody,input)))),
  updateDefinition:(taxonomy:string,input:unknown,locale?:string)=>run(['taxonomies:manage'],async()=>result(await handlers.handleTaxonomyUpdate(database.db as any,name(taxonomy),{...validated(schemas.updateTaxonomyDefBody,input),locale})),locale),
  deleteDefinition:(taxonomy:string)=>run(['taxonomies:manage'],async()=>result(await handlers.handleTaxonomyDelete(database.db as any,name(taxonomy)))),
  listTerms:(taxonomy:string,locale?:string,includeCounts=true)=>run(['taxonomies:read'],async()=>result(await handlers.handleTermList(database.db as any,name(taxonomy),{locale,includeCounts,resolveFallback:Boolean(locale)})),locale),
  createTerm:(taxonomy:string,input:unknown)=>run(['taxonomies:manage'],async()=>result(await handlers.handleTermCreate(database.db as any,name(taxonomy),validated(schemas.createTermBody,input)))),
  getTerm:(taxonomy:string,slug:string,locale?:string)=>run(['taxonomies:read'],async()=>result(await handlers.handleTermGet(database.db as any,name(taxonomy),slug,{locale})),locale),
  termTranslations:(taxonomy:string,slug:string,locale?:string)=>run(['taxonomies:read'],async()=>result(await handlers.handleTermTranslations(database.db as any,(await new TaxonomyRepository(database.db as any).findBySlug(name(taxonomy),slug,locale))?.id??slug)),locale),
  updateTerm:(taxonomy:string,slug:string,input:unknown,locale?:string)=>run(['taxonomies:manage'],async()=>result(await handlers.handleTermUpdate(database.db as any,name(taxonomy),slug,validated(schemas.updateTermBody,input),{locale})),locale),
  deleteTerm:(taxonomy:string,slug:string,locale?:string)=>run(['taxonomies:manage'],async()=>result(await handlers.handleTermDelete(database.db as any,name(taxonomy),slug,{locale})),locale),
  reorderTerms:(taxonomy:string,input:unknown)=>run(['taxonomies:manage'],async()=>result(await handlers.handleTermReorder(database.db as any,name(taxonomy),validated(schemas.reorderTermsBody,input)))),
  bulkTag:(origin:string,input:unknown)=>run(['taxonomies:manage'],async()=>result(await handleBulkTag(database.db as any,origin,validated(schemas.bulkTagBody,input)))),
  async entryTaxonomies(input:EntryTaxonomyKey){
   permission('content:read');permission('content:read_drafts');
   return run(['content:read'],async()=>{const value=key(input);await entry(value);const repo=new TaxonomyRepository(database.db as any);const definitions=(await getTaxonomyDefs({locale:value.locale})).filter(def=>def.collections.includes(value.collection));
    return Promise.all(definitions.map(async definition=>({definition,terms:result(await handlers.handleTermList(database.db as any,definition.name,{locale:value.locale,includeCounts:false,resolveFallback:true})).terms,assignment:assignmentResponse(await repo.getTermAssignmentsForEntry(value.collection,value.id,definition.name,value.locale,getI18nConfig()?.defaultLocale??'en'),value.locale)})));
   },input.locale);
  },
  async setEntryTerms(input:EntryTaxonomyKey&{taxonomy:string;termIds:string[]}){
   const actor=permission('content:edit_own','content:edit_any');
   return run(['content:edit_own','content:edit_any'],async()=>{
    const value=key(input),taxonomy=name(input.taxonomy),item=await entry(value);
    if(!actor.permissions.has('content:edit_any')&&item.authorId!==actor.id)throw new CmsError('FORBIDDEN');
    if(!Array.isArray(input.termIds)||input.termIds.some(id=>typeof id!=='string'||!id))throw new CmsError('VALIDATION_ERROR');
    const plan=await entryTaxonomyPlan(database,value.collection,taxonomy,input.termIds),token=ulid();
    try{await database.atomicBatch([
     sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN EXISTS(SELECT 1 FROM ${sql.ref(tableName(value.collection))} WHERE id=${value.id} AND locale=${value.locale} AND deleted_at IS NULL AND version=${item.version} AND updated_at=${item.updatedAt} ${actor.permissions.has('content:edit_any')?sql``:sql`AND author_id=${actor.id}`}) THEN 1 ELSE 0 END`.compile(database.db),
     ...plan.queries(item.translationGroup??item.id),sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db)
    ]);}catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
    plan.invalidate();const repo=new TaxonomyRepository(database.db as any);return assignmentResponse(await repo.getTermAssignmentsForEntry(value.collection,value.id,taxonomy,value.locale,getI18nConfig()?.defaultLocale??'en'),value.locale);
   },input.locale);
  }
 };
}
