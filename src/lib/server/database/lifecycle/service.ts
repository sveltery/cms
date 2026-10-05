import { sql, type CompiledQuery } from 'kysely';
import type {ContentReferencePlan} from '../../relations/content-plan.ts';
import {hydrateBoundContentReferences} from '../../relations/read-host.ts';
import {referenceSelectionMap} from '../content-validation.ts';
import { ulid } from 'ulidx';
import { CmsError, type CmsDatabase, type RevisionPrecondition } from '../contract.ts';
import type { ServerPrincipal } from '../service.ts';
import { DraftRepository } from '../entries.ts';
import { SchemaRegistry } from '../registry.ts';
import { entryId, identifier, localeInput, parse, schemaData, tableName } from '../validation.ts';
import { serializeValue } from '../field-value.ts';
import { validateContentData } from '../../schema/validate-content.ts';
import { registerLifecycleDatabase, type LifecycleDependencies } from './upstream/host.ts';
import { ContentRepository } from './upstream/database/repositories/content.ts';
import { RevisionRepository, type Revision } from './upstream/database/repositories/revision.ts';
import { ContentMutationConflictError, EmDashValidationError, type ContentItem } from './upstream/database/repositories/types.ts';
import { keepKnownFields, staleStoredKeys } from './upstream/content/known-fields.ts';
import { ContentDatetimeNormalizer } from './upstream/database/content-datetime.ts';
import { LifecycleSlugConflictError } from './errors.ts';
import {prepareContentSlugRedirect,executeContentSlugBatch,completeContentSlugRedirect} from '../../redirects/content-atomic.ts';
import {publicationStatementExecutor} from '../../redirects/publication-atomic.ts';
import * as v from 'valibot';
import {BylineRepository,type ContentBylineInput} from '../../bylines/repository.ts';
import {bylineDatabase} from '../../bylines/storage.ts';
import {hydrateBylines,hydrateBylinesMany} from '../../bylines/content-hydration.ts';
import {resolveBylineFilter} from '../../bylines/content-list.ts';
import {invalidateCollectionCache} from '../../menus/object-cache.ts';
import {contentBylineInput} from '../content-validation.ts';
import {canonicalSourceDatabase} from '../../canonical-storage/namespace.ts';
import {getI18nConfig,resolveConfiguredLocale} from '../../menus/i18n-config.ts';
import {resolveTaxonomySlugMap,contentTaxonomyStatements,newContentTaxonomyStatements,completeContentTaxonomies,type ResolvedTaxonomySelection} from '../../taxonomies/content-write.ts';

// Runtime draft-stage, hydration and retention algorithms adapted from
// EmDashRuntime.handleContentUpdate:3538,hydrateDraftData:3257 and revision
// restore:4974 at immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
const DRAFT_ONLY_UPDATE_KEYS = new Set(['data','slug','locale','skipRevision','taxonomies','references','actor','migrateBlocks','replaceBlocks']);
const UNSUPPORTED = ['seo','actor','migrateBlocks','replaceBlocks','inheritFields'];
export interface ContentKey {type:string;id:string;locale?:string}
export interface ContentMutation extends ContentKey {expected?:RevisionPrecondition}
export interface ContentUpdate extends ContentMutation {
  data?:Record<string,unknown>;bylines?:ContentBylineInput[];taxonomies?:Record<string,string[]>;references?:Record<string,string[]>;slug?:string|null;skipRevision?:boolean;publishedAt?:string|null;
}
export interface ContentReceipt {item:ContentItem;liveContentChanged:boolean}
/** Trusted importer/API attribution metadata; never read from mutation input. */
export interface ContentCreationAttribution {readonly authorId?:string|null;readonly status?:'draft'|'published'}

/** Compose only with trusted authentication; input never supplies identity. */
export function lifecycleService(database:CmsDatabase, principal:ServerPrincipal|null, dependencies:LifecycleDependencies={},creationAttribution?:ContentCreationAttribution) {
  registerLifecycleDatabase(database,dependencies);
  const creationMetadata=creationAttribution===undefined?undefined:{authorId:creationAttribution.authorId||null,status:creationAttribution.status??'draft'};
  const identity=principal&&typeof principal.id==='string'&&principal.id.length>0&&principal.id.length<=128&&Array.isArray(principal.permissions)
    ? {id:principal.id,permissions:new Set<string>(principal.permissions)} : null;
  const registry=new SchemaRegistry(database);
  const drafts=new DraftRepository(database);
  const content=new ContentRepository(database.db as any);
  const revisions=new RevisionRepository(database.db as any);
  const datetimes=new ContentDatetimeNormalizer(database.db as any);
  const bylines=new BylineRepository(database);
  async function hydratedBylines(item:ContentItem) {await hydrateBylines(bylineDatabase(database),item.type,item);return item;}
  function completeBylines(collection:string,input:ContentBylineInput[]|undefined) {if(input!==undefined)invalidateCollectionCache(collection);}
  function authenticated() {if(!identity)throw new CmsError('UNAUTHENTICATED');return identity;}
  function requirePermission(permission:string) {const actor=authenticated();if(!actor.permissions.has(permission))throw new CmsError('FORBIDDEN');return actor;}
  function mutationPermission(own:string,any:string) {
    const actor=authenticated();if(!actor.permissions.has(own)&&!actor.permissions.has(any))throw new CmsError('FORBIDDEN');return actor;
  }
  function object(input:unknown,bylineSelections=true):Record<string,any> {
    if(!input||typeof input!=='object'||Array.isArray(input))throw new CmsError('VALIDATION_ERROR');
    const value=input as Record<string,any>;
    for(const key of UNSUPPORTED)if(value[key]!==undefined)throw new CmsError('VALIDATION_ERROR',`Lifecycle capability '${key}' is not implemented`);
    if(value.slug!==undefined)parse(v.nullable(v.pipe(v.string(),v.maxLength(200))),value.slug);
    if(value.taxonomies!==undefined&&(value.taxonomies===null||typeof value.taxonomies!=='object'||Array.isArray(value.taxonomies)))throw new CmsError('VALIDATION_ERROR','taxonomies must be a map of term slugs');
    if(bylineSelections&&value.bylines!==undefined)parse(contentBylineInput,value.bylines);
    if(value.references!==undefined)parse(referenceSelectionMap,value.references);
    if(value.skipRevision!==undefined)parse(v.boolean(),value.skipRevision);
    if(value.status!==undefined)parse(v.string(),value.status);
    return value;
  }
  function key(input:unknown):Record<string,any>&ContentKey&{locale:string} {
    const value=object(input);
    return {...value,type:parse(identifier,value.type),id:parse(entryId,value.id),locale:parse(localeInput,value.locale??'en')};
  }
  function precondition(expected:unknown,item:ContentItem) {
    if(expected===undefined)return;
    if(!expected||typeof expected!=='object')throw new CmsError('CONFLICT');
    const value=expected as RevisionPrecondition;
    if(value.version!==item.version||value.updatedAt!==item.updatedAt)throw new CmsError('CONFLICT');
  }
  async function definition(type:string) {const value=await registry.getCollectionWithFields(type);if(!value)throw new CmsError('NOT_FOUND');return value;}
  async function stored(value:ContentKey,inferLocale=false,resolveIdentifier=false) {
    await definition(value.type);
    const item=resolveIdentifier?await content.findByIdOrSlug(value.type,value.id,inferLocale?undefined:value.locale):await content.findById(value.type,value.id);
    if(!item||(!resolveIdentifier&&!inferLocale&&item.locale!==(value.locale??'en')))throw new CmsError('NOT_FOUND');return item;
  }
  function owner(item:ContentItem,actor:NonNullable<typeof identity>,any:string) {
    if(!actor.permissions.has(any)&&item.authorId!==actor.id)throw new CmsError('FORBIDDEN');
  }
  function publicationDatePermission(value:Record<string,unknown>) {
    // Pinned route/MCP gates explicit presence, including a null clear.
    if(value.publishedAt!==undefined&&!authenticated().permissions.has('content:publish_any'))
      throw new CmsError('FORBIDDEN','Missing permission: content:publish_any');
  }
  async function checked(type:string,data:Record<string,unknown>,partial:boolean) {
    parse(schemaData,data);
    const validation=await validateContentData(database,type,data,{partial});
    if(!validation.ok)throw new CmsError(validation.error.code==='COLLECTION_NOT_FOUND'?'NOT_FOUND':validation.error.code,validation.error.message,validation.error.details);
  }
  // EmDashRuntime.normalizeContentFields:5804 at the pinned source. Optional
  // array-valued editors can submit a blank string; required fields still
  // reject the resulting null through the normal source validation path.
  function normalizeBlankArrays(data:Record<string,unknown>,fields:Array<{slug:string;type:string}>) {
    let normalized=data;
    for(const field of fields) {
      const value=data[field.slug];
      if(['portableText','multiSelect','repeater'].includes(field.type)&&typeof value==='string'&&value.trim()==='') {
        if(normalized===data)normalized={...data};
        normalized[field.slug]=null;
      }
    }
    return normalized;
  }
  async function hydrate(item:ContentItem):Promise<ContentItem> {
    if(!item.draftRevisionId)return hydratedBylines(item);
    const revision=await revisions.findById(item.draftRevisionId);
    if(!revision)return hydratedBylines(item);
    const draftData:Record<string,unknown>={};
    for(const [field,value]of Object.entries(revision.data))if(!field.startsWith('_'))draftData[field]=value;
    return hydratedBylines({...item,data:{...item.data,...draftData},liveData:item.data});
  }
  async function hydrateReferences(item:ContentItem,includeDrafts:boolean):Promise<ContentItem> {
    const collection=await definition(item.type);
    return hydrateBoundContentReferences(database,item,collection.fields,includeDrafts);
  }
  function prune(collection:string,id:string,revisionId:string) {
    // Pinned runtime/cleanup isolate deferred bookkeeping failures. The queue
    // remains unacknowledged when pruning fails, so later work can retry it.
    const task=async()=>{
      try {await revisions.pruneQueuedEntry(collection,id,revisionId,50);}
      catch(error){console.error(`[revisions] Failed to prune revisions for ${collection}/${id}:`,error);}
    };
    try {
      if(dependencies.after)dependencies.after(task);
      else void task();
    } catch(error) {
      // Only the trusted maintenance scheduler is inside this boundary. The
      // mutation has committed; its queued revision stays available for retry.
      console.error(`[revisions] Failed to schedule pruning for ${collection}/${id}:`,error);
    }
  }
  async function translate<T>(operation:()=>Promise<T>):Promise<T> {
    try{return await operation();}
    catch(cause){
      if(cause instanceof ContentMutationConflictError)throw new CmsError('CONFLICT',cause.message);
      if(cause instanceof EmDashValidationError){
        throw LifecycleSlugConflictError.fromValidation(cause)??new CmsError('VALIDATION_ERROR',cause.message);
      }
      throw cause;
    }
  }
  async function prepareAtomicUpdate(value:ReturnType<typeof key>,item:ContentItem,input:Record<string,any>,data:Record<string,unknown>|undefined,anyPermission:string,selections:readonly ResolvedTaxonomySelection[]=[],references?:ContentReferencePlan) {
    const actor=authenticated();const assignments=[];
    const collection=await definition(value.type);
    if((input.status??item.status)==='published'&&collection.routable&&!(input.slug!==undefined?input.slug:item.slug)?.trim())
      throw new CmsError('VALIDATION_ERROR','Cannot publish routable content without a slug');
    let newPublishedAt=item.publishedAt??null;
    if(data!==undefined)for(const[field,contentValue]of Object.entries(data))assignments.push(sql`${sql.ref(field)}=${serializeValue(contentValue)}`);
    if(input.slug!==undefined)assignments.push(sql`slug=${input.slug}`);
    if(input.status!==undefined)assignments.push(sql`status=${input.status}`);
    if(input.publishedAt!==undefined){newPublishedAt=input.publishedAt===null?null:await translate(()=>datetimes.normalizeValue(value.type,input.publishedAt));assignments.push(sql`published_at=${newPublishedAt}`);}
    if(assignments.length)assignments.push(sql`updated_at=${new Date().toISOString()}`);
    assignments.push(sql`version=version+1`);
    const token=ulid();
    const redirects=await prepareContentSlugRedirect(database,{collection:value.type,id:value.id,
      oldSlug:item.slug,newSlug:input.slug,urlPattern:collection.urlPattern??null,
      oldPublishedAt:item.publishedAt??null,newPublishedAt});
    const taxonomy=contentTaxonomyStatements(database,value.type,item.translationGroup??null,selections);
    const bylineStatements=input.bylines===undefined?[]:await bylines.planContentBylineReplacement(value.type,value.id,input.bylines);
    const hasSideWrites=selections.length>0||input.bylines!==undefined||!!references?.after.length;
    const updatedToken=ulid();
    const prefix:CompiledQuery[]=[
      sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN EXISTS(SELECT 1 FROM _cms_collections WHERE id=${collection.id} AND version=${collection.version})THEN 1 ELSE 0 END`.compile(database.db),
      ...taxonomy.before,...(references?.before??[]),
      // Keep this UPDATE last: the existing redirect owner requires its own
      // changes() guard immediately after the actual content mutation.
      sql`UPDATE ${sql.ref(tableName(value.type))} SET ${sql.join(assignments)} WHERE id=${value.id} AND locale=${value.locale}
        AND deleted_at IS NULL AND version=${item.version} AND updated_at=${item.updatedAt}
        ${actor.permissions.has(anyPermission)?sql``:sql`AND author_id=${actor.id}`} RETURNING *`.compile(database.db)
    ];
    const updateResultIndex=prefix.length-1;
    const suffix:CompiledQuery[]=[
      ...(hasSideWrites?[sql`INSERT INTO _cms_guards(token,pass) SELECT ${updatedToken},CASE WHEN
        ${redirects?sql``:sql`changes()=1 AND`} EXISTS(
          SELECT 1 FROM ${sql.ref(tableName(value.type))} WHERE id=${value.id} AND locale=${value.locale}
          AND deleted_at IS NULL AND version=${item.version+1}
          ${actor.permissions.has(anyPermission)?sql``:sql`AND author_id=${actor.id}`}
        )THEN 1 ELSE 0 END`.compile(database.db)]:[]),
      ...taxonomy.after,...bylineStatements,...(references?.after??[]),...taxonomy.cleanup,...(references?.cleanup??[]),
      ...(hasSideWrites?[sql`DELETE FROM _cms_guards WHERE token=${updatedToken}`.compile(database.db)]:[]),
      sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db)
    ];
    return {prefix,suffix,redirects,updateResultIndex,selections,bylineInput:input.bylines as ContentBylineInput[]|undefined};
  }
  async function atomicUpdate(value:ReturnType<typeof key>,item:ContentItem,input:Record<string,any>,data:Record<string,unknown>|undefined,anyPermission:string,selections:readonly ResolvedTaxonomySelection[]=[],references?:ContentReferencePlan) {
    const plan=await prepareAtomicUpdate(value,item,input,data,anyPermission,selections,references);
    const {prefix,suffix,redirects,updateResultIndex}=plan;
    const statements=[...prefix,...(redirects?.statements??[]),...suffix];
    let results;
    try{results=redirects?await executeContentSlugBatch(database,prefix,redirects,suffix):await database.atomicBatch(statements);}
    catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
    const row=results[updateResultIndex]?.rows[0] as Record<string,unknown>|undefined;
    if(!row)throw new CmsError('CONFLICT');
    if(redirects&&redirects.redirectResultIndices.some(index=>results[prefix.length+index]?.rows.length))completeContentSlugRedirect(database,dependencies.after);
    await completeContentTaxonomies(selections);completeBylines(value.type,plan.bylineInput);
    if(references){const {completeContentReferences}=await import('../../relations/content-input.ts');completeContentReferences(references);}
    return plan.bylineInput===undefined?content.mapRow(value.type,row):stored(value);
  }

  return {
    async createContent(input:unknown):Promise<ContentItem> {
      const actor=requirePermission('content:create');const value=object(input);
      publicationDatePermission(value);
      const type=parse(identifier,value.type);const locale=parse(localeInput,value.locale===undefined?getI18nConfig()?.defaultLocale??'en':resolveConfiguredLocale(parse(localeInput,value.locale)));
      if(value.status!==undefined&&value.status!=='draft'&&!(creationMetadata?.status==='published'&&value.status==='published'))throw new CmsError('VALIDATION_ERROR','Create a draft, then publish it');
      const collection=await definition(type);
      let data=normalizeBlankArrays(parse(schemaData,value.data),collection.fields);
      let translation: {id:string;translationGroup:string;version:number;updatedAt:string;inheritFields:string[]}|undefined;
      if(value.translationOf!==undefined){
        const source=await content.findById(type,parse(entryId,value.translationOf));if(!source)throw new CmsError('NOT_FOUND','Translation source content not found');
        const inheritFields=collection.fields.filter(field=>!field.translatable&&!(field.type==='reference'&&field.validation?.relation)).map(field=>field.slug);
        data={...data};for(const field of inheritFields){if(Object.hasOwn(source.data,field))data[field]=source.data[field];else delete data[field];}
        translation={id:source.id,translationGroup:source.translationGroup??source.id,version:source.version,updatedAt:source.updatedAt,inheritFields};
      }
      const slugSource=typeof data.title==='string'&&data.title.length>0?data.title:typeof data.name==='string'&&data.name.length>0?data.name:null;
      const slug=value.slug===undefined?(slugSource?await content.generateUniqueSlug(type,slugSource,locale):null):value.slug;
      if(creationMetadata?.status==='published'){
        const publisher=mutationPermission('content:publish_own','content:publish_any');
        if(!publisher.permissions.has('content:publish_any')&&creationMetadata.authorId!==publisher.id)throw new CmsError('FORBIDDEN');
        if(collection.routable&&!slug?.trim())throw new CmsError('VALIDATION_ERROR','Cannot publish routable content without a slug');
      }
      const selections=value.taxonomies===undefined?[]:await translate(()=>resolveTaxonomySlugMap(canonicalSourceDatabase(database),value.taxonomies,locale));
      const needsReferences=value.references!==undefined||collection.fields.some(field=>field.type==='reference'&&field.validation?.relation&&field.required);
      const references=needsReferences?await (await import('../../relations/content-input.ts')).prepareContentReferencesCreate(database,type,value.references):undefined;
      let referencePlan:ContentReferencePlan|undefined;
      const hasSideWrites=selections.length>0||value.bylines!==undefined||translation!==undefined||references!==undefined;
      const dates={
        createdAt:value.createdAt?await translate(()=>datetimes.normalizeValue(type,value.createdAt)):undefined,
        publishedAt:value.publishedAt?await translate(()=>datetimes.normalizeValue(type,value.publishedAt)):null,
        ...creationMetadata
      };
      const item=await drafts.create({type,locale,data,slug},actor.id,hasSideWrites?async entry=>{
        const taxonomy=newContentTaxonomyStatements(database,type,entry,selections);
        const statements=value.bylines!==undefined?await bylines.planContentBylineReplacement(type,entry.id,value.bylines)
          :translation?await bylines.planContentBylineCopy(type,translation.id,entry.id):[];
        referencePlan=references?.(entry.translationGroup);
        return {before:[...taxonomy.before,...(referencePlan?.before??[])],after:[...taxonomy.after,...statements,...(referencePlan?.after??[])],cleanup:[...taxonomy.cleanup,...(referencePlan?.cleanup??[])]};
      }:undefined,translation,dates);
      await completeContentTaxonomies(selections);if(value.bylines!==undefined||translation)invalidateCollectionCache(type);
      if(referencePlan){const {completeContentReferences}=await import('../../relations/content-input.ts');completeContentReferences(referencePlan);}
      return hydrateReferences(await hydratedBylines(await stored({type,id:item.id,locale})),true);
    },
    async duplicateContent(input:unknown):Promise<ContentItem> {
      const actor=requirePermission('content:create');mutationPermission('content:edit_own','content:edit_any');
      const value=key(input);const original=await stored(value,true,true);owner(original,actor,'content:edit_any');
      const data={...original.data};
      if(typeof data.title==='string')data.title=`${data.title} (Copy)`;
      else if(typeof data.name==='string')data.name=`${data.name} (Copy)`;
      const source=typeof data.title==='string'?data.title:typeof data.name==='string'?data.name:null;
      const slug=source?await content.generateUniqueSlug(value.type,source,original.locale??undefined):null;
      const existingBylines=await bylines.getContentBylines(value.type,original.id);
      const attribution=creationMetadata===undefined?undefined:{authorId:creationMetadata.authorId||original.authorId||null};
      const item=await drafts.create({type:value.type,locale:original.locale??'en',slug,data},actor.id,
        existingBylines.length?async entry=>{
          const plan=newContentTaxonomyStatements(database,value.type,entry,[]);
          const statements=await bylines.planContentBylineReplacement(value.type,entry.id,
            existingBylines.map(credit=>({bylineId:credit.byline.id,roleLabel:credit.roleLabel})));
          return {...plan,after:[...plan.after,...statements]};
        }:undefined,undefined,attribution);
      invalidateCollectionCache(value.type);return hydratedBylines(await stored({type:value.type,id:item.id,locale:item.locale}));
    },
    async permanentDeleteContent(input:unknown):Promise<void> {
      requirePermission('content:delete_permanent');const raw=object(input);const value=key(raw);const collection=await definition(value.type);
      const table=sql.ref(tableName(value.type));
      const row=(await sql<Record<string,unknown>>`SELECT * FROM ${table} WHERE id=${value.id} AND deleted_at IS NOT NULL
        ${raw.locale===undefined?sql``:sql`AND locale=${value.locale}`}`.execute(database.db)).rows[0];
      if(!row)throw new CmsError('NOT_FOUND');const item=content.mapRow(value.type,row);precondition(value.expected,item);
      const schemaToken=ulid();const entryToken=ulid();const deletionToken=ulid();
      const statements:CompiledQuery[]=[
        sql`INSERT INTO _cms_guards(token,pass) SELECT ${schemaToken},CASE WHEN EXISTS(SELECT 1 FROM _cms_collections
          WHERE id=${collection.id} AND version=${collection.version})THEN 1 ELSE 0 END`.compile(database.db),
        sql`INSERT INTO _cms_guards(token,pass) SELECT ${entryToken},CASE WHEN EXISTS(SELECT 1 FROM ${table}
          WHERE id=${item.id} AND locale=${item.locale} AND deleted_at=${row.deleted_at} AND version=${item.version}
          AND updated_at=${item.updatedAt})THEN 1 ELSE 0 END`.compile(database.db),
        sql`DELETE FROM ${table} WHERE id=${item.id} AND locale=${item.locale} AND deleted_at=${row.deleted_at}
          AND version=${item.version} AND updated_at=${item.updatedAt} RETURNING id`.compile(database.db),
        sql`INSERT INTO _cms_guards(token,pass) SELECT ${deletionToken},CASE WHEN changes()=1 THEN 1 ELSE 0 END`.compile(database.db),
        sql`DELETE FROM _cms_comments WHERE collection=${value.type} AND content_id=${item.id}`.compile(database.db),
        sql`DELETE FROM _cms_revisions WHERE collection=${value.type} AND entry_id=${item.id}`.compile(database.db),
        sql`DELETE FROM _cms_revision_prune_queue WHERE collection=${value.type} AND entry_id=${item.id}`.compile(database.db),
        ...await bylines.planContentBylineDeletion(value.type,item.id),
        ...(item.translationGroup?[sql`DELETE FROM _cms_content_taxonomies WHERE collection=${value.type} AND entry_id=${item.translationGroup}
          AND NOT EXISTS(SELECT 1 FROM ${table} WHERE translation_group=${item.translationGroup})`.compile(database.db)]:[]),
        sql`DELETE FROM _cms_guards WHERE token IN(${schemaToken},${entryToken},${deletionToken})`.compile(database.db)
      ];
      try{await database.atomicBatch(statements);}
      catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
      invalidateCollectionCache(value.type);
      const {invalidateCommentObjectCache,invalidateTaxonomyObjectCache}=await import('../../menus/object-cache.ts');
      invalidateCommentObjectCache();invalidateTaxonomyObjectCache();
    },
    async getContent(input:unknown,options:{inferLocale?:boolean;resolveIdentifier?:boolean}={}):Promise<ContentItem> {
      requirePermission('content:read');requirePermission('content:read_drafts');
      // Only the trusted constructor host opts into omitted-locale inference;
      // all callers share the same actual definition/read/not-found owner.
      const inferLocale=options.inferLocale===true&&object(input).locale===undefined;
      return hydrateReferences(await hydrate(await stored(key(input),inferLocale,options.resolveIdentifier===true)),true);
    },
    async getPublishedContent(input:unknown):Promise<ContentItem> {
      requirePermission('content:read');const item=await stored(key(input));
      if(item.status!=='published')throw new CmsError('NOT_FOUND');
      return hydrateReferences(await hydratedBylines(item),false);
    },
    async compareContent(input:unknown) {
      requirePermission('content:read');requirePermission('content:read_drafts');
      const value=key(input);
      // A shared slug can identify multiple locales. Retain the resolved row's
      // identity when the unchanged Source comparison performs its second read.
      const item=await stored(value,false,true);
      const {compareContentReferences}=await import('../../relations/content-read.ts');
      const result=await compareContentReferences(database,value.type,item.id);
      if(!result.success){if(result.error.code==='NOT_FOUND')throw new CmsError('NOT_FOUND',result.error.message);throw new Error(result.error.message);}
      return result.data;
    },
    async listContent(input:unknown,options:{allLocales?:boolean;sourceSchemaDiscovery?:boolean}={}) {
      requirePermission('content:read');requirePermission('content:read_drafts');const value=object(input,false);
      const type=parse(identifier,value.type);const locale=parse(localeInput,value.locale??'en');
      const collection=options.sourceSchemaDiscovery===true?await registry.getCollectionWithFields(type):await definition(type);
      if(value.status!==undefined&&typeof value.status!=='string')throw new CmsError('VALIDATION_ERROR');
      if(value.limit!==undefined&&(!Number.isSafeInteger(value.limit)||value.limit<1))throw new CmsError('VALIDATION_ERROR');
      const filterLocale=options.allLocales===true&&value.locale===undefined?undefined:locale;
      const bylineFilter=resolveBylineFilter(value,filterLocale);
      const result=await content.findMany(type,{limit:value.limit,cursor:value.cursor,
        ...(value.orderBy?{orderBy:{field:value.orderBy,direction:value.order??'desc'}}:{}),
        sortableExtras:[collection?.titleField,collection?.dateField].filter((field):field is string=>Boolean(field)),
        where:{...(filterLocale===undefined?{}:{locale:filterLocale}),...(value.status===undefined?{}:{status:value.status}),...(bylineFilter?{bylineFilter}:{})}});
      await hydrateBylinesMany(bylineDatabase(database),type,result.items);return result;
    },
    async updateContent(input:unknown):Promise<ContentReceipt> {
      const actor=mutationPermission('content:edit_own','content:edit_any');const value=key(input);
      let existing=await stored(value);owner(existing,actor,'content:edit_any');precondition(value.expected,existing);
      publicationDatePermission(value);
      const collection=await definition(value.type);const fields=new Set(collection.fields.map(field=>field.slug));
      let data=value.data===undefined?undefined:normalizeBlankArrays(parse(schemaData,value.data),collection.fields);
      if(data){
        const base=existing.draftRevisionId?(await revisions.findById(existing.draftRevisionId))?.data??existing.data:existing.data;
        const stale=staleStoredKeys(data,base,fields);if(stale.length){data={...data};for(const field of stale)delete data[field];}
        await checked(value.type,data,true);
      }
      const usesDraftRevisions=(data!==undefined||value.references!==undefined)&&collection.supports.includes('revisions');
      const referenceDraft=usesDraftRevisions&&value.references!==undefined?await (await import('../../relations/content-input.ts')).prepareContentReferenceDraft(database,value.type,value.id,value.references):undefined;
      const references=usesDraftRevisions||value.references===undefined?undefined:await (await import('../../relations/content-input.ts')).prepareContentReferencesUpdate(database,value.type,value.id,value.references);
      const taxonomySelections=value.taxonomies===undefined?[]:await translate(()=>resolveTaxonomySlugMap(canonicalSourceDatabase(database),value.taxonomies,value.locale));
      const liveMetaTouched=Object.entries(value).some(([field,fieldValue])=>fieldValue!==undefined&&!['type','id','expected','_rev'].includes(field)&&!DRAFT_ONLY_UPDATE_KEYS.has(field));
      if(usesDraftRevisions){
        for(let attempt=0;attempt<32;attempt++){
          owner(existing,actor,'content:edit_any');precondition(value.expected,existing);
          const base=existing.draftRevisionId?(await revisions.findById(existing.draftRevisionId))?.data??existing.data:existing.data;
          const merged=keepKnownFields({...base,...data},fields);if(value.slug!==undefined)merged._slug=value.slug;
          if(referenceDraft){const {mergeStagedReferences,mergeStagedReferenceBaselines}=await import('../../relations/staged.ts');merged._references=mergeStagedReferences(base,referenceDraft.staged);merged._referencesBaseline=mergeStagedReferenceBaselines(base,referenceDraft.baselines);}
          const revisionInput={collection:value.type,entryId:value.id,data:merged,authorId:actor.id};
          // With taxonomy writes, insert the real revision and stage it in the
          // same actual fixed batch. Existing no-taxonomy Source staging stays.
          const prepared=taxonomySelections.length||value.bylines!==undefined||referenceDraft?await revisions.prepareCreate(revisionInput):undefined;
          const revision=prepared?{id:prepared.id}:await revisions.create(revisionInput);
          const metadata=prepared&&liveMetaTouched?await prepareAtomicUpdate(value,
            {...existing,version:existing.version+1,draftRevisionId:prepared.id},
            {...value,slug:undefined,bylines:undefined},undefined,'content:edit_any'):undefined;
          let staged;
          try{staged=await content.replaceDraftRevision(value.type,value.id,revision.id,existing,prepared?async statement=>{
            const schemaToken=ulid();const entryToken=ulid();const stageToken=ulid();const metadataToken=ulid();
            const taxonomy=contentTaxonomyStatements(database,value.type,existing.translationGroup??null,taxonomySelections);
            const bylineStatements=value.bylines===undefined?[]:await bylines.planContentBylineReplacement(value.type,value.id,value.bylines);
            if(metadata?.redirects)throw new Error('Draft-stage metadata unexpectedly prepared a slug redirect');
            const statements:CompiledQuery[]=[
              sql`INSERT INTO _cms_guards(token,pass) SELECT ${schemaToken},CASE WHEN EXISTS(SELECT 1 FROM _cms_collections
                WHERE id=${collection.id} AND version=${collection.version})THEN 1 ELSE 0 END`.compile(database.db),
              sql`INSERT INTO _cms_guards(token,pass) SELECT ${entryToken},CASE WHEN EXISTS(SELECT 1 FROM ${sql.ref(tableName(value.type))}
                WHERE id=${value.id} AND locale=${value.locale} AND deleted_at IS NULL AND version=${existing.version} AND updated_at=${existing.updatedAt}
                AND ${existing.liveRevisionId===null?sql`live_revision_id IS NULL`:sql`live_revision_id=${existing.liveRevisionId}`}
                AND ${existing.draftRevisionId===null?sql`draft_revision_id IS NULL`:sql`draft_revision_id=${existing.draftRevisionId}`}
                ${actor.permissions.has('content:edit_any')?sql``:sql`AND author_id=${actor.id}`}
              )THEN 1 ELSE 0 END`.compile(database.db),
              ...taxonomy.before,prepared.statement,statement,
              sql`INSERT INTO _cms_guards(token,pass) SELECT ${stageToken},CASE WHEN changes()=1 AND EXISTS(SELECT 1 FROM ${sql.ref(tableName(value.type))}
                WHERE id=${value.id} AND draft_revision_id=${prepared.id} AND version=${existing.version+1} AND deleted_at IS NULL
              )THEN 1 ELSE 0 END`.compile(database.db),
              ...(metadata?[...metadata.prefix,
                sql`INSERT INTO _cms_guards(token,pass) SELECT ${metadataToken},CASE WHEN changes()=1 THEN 1 ELSE 0 END`.compile(database.db),
                ...metadata.suffix]:[]),
              ...taxonomy.after,...bylineStatements,...taxonomy.cleanup,
              sql`DELETE FROM _cms_guards WHERE token IN(${schemaToken},${entryToken},${stageToken},${metadataToken})`.compile(database.db)
            ];
            let results;try{results=await database.atomicBatch(statements);}
            catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
            const result=results[3+taxonomy.before.length];
            if(!result)throw new Error('Missing actual revision stage statement result');
            return result;
          }:undefined);}
          catch(cause){
            await revisions.deleteIfUnreferenced(value.type,value.id,revision.id);
            if(prepared&&cause instanceof CmsError&&cause.code==='CONFLICT'&&value.expected===undefined&&attempt<31){existing=await stored(value);continue;}
            throw cause;
          }
          if(!staged){
            await revisions.deleteIfUnreferenced(value.type,value.id,revision.id);
            if(value.expected!==undefined||attempt===31)throw new CmsError('CONFLICT');existing=await stored(value);continue;
          }
          if(prepared){completeBylines(value.type,value.bylines);await revisions.queuePruning(value.type,value.id,prepared.id);await completeContentTaxonomies(taxonomySelections);}
          if(referenceDraft){const {completeContentReferenceDraft}=await import('../../relations/content-input.ts');completeContentReferenceDraft(value.type);}
          if(value.skipRevision&&existing.draftRevisionId)await revisions.deleteIfUnreferenced(value.type,value.id,existing.draftRevisionId);
          else prune(value.type,value.id,revision.id);
          let item=await stored(value);
          if(liveMetaTouched&&!prepared)item=await atomicUpdate(value,item,{...value,slug:undefined},undefined,'content:edit_any');
          return {item:await hydrate(item),liveContentChanged:liveMetaTouched||taxonomySelections.length>0};
        }
        throw new CmsError('CONFLICT');
      }
      const item=await atomicUpdate(value,existing,value,data,'content:edit_any',taxonomySelections,references);
      return {item:await hydrate(item),liveContentChanged:Boolean(data||value.slug!==undefined||liveMetaTouched||taxonomySelections.length||references?.after.length)};
    },
    async publish(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:publish_own','content:publish_any');const value=key(input);const item=await stored(value);
      owner(item,actor,'content:publish_any');precondition(value.expected,item);const collection=await definition(value.type);
      publicationDatePermission(value);
      let redirectCreated=false;
      const needsReferences=collection.fields.some(field=>field.type==='reference'&&field.validation?.relation);
      const publicationReferences=needsReferences?await (await import('../../relations/content-input.ts')).prepareContentReferencePublication(database,value.type,item,
        item.draftRevisionId?(await revisions.findById(item.draftRevisionId))?.data:undefined):undefined;
      const executePublication=publicationStatementExecutor(database,{id:collection.id,slug:value.type,version:collection.version,urlPattern:collection.urlPattern??null},candidate=>{redirectCreated=candidate;},publicationReferences);
      const published=await translate(()=>content.publish(value.type,value.id,value.publishedAt,false,undefined,collection.supports.includes('revisions'),collection.routable,
        {version:item.version,updatedAt:item.updatedAt},undefined,executePublication));
      if(redirectCreated)completeContentSlugRedirect(database,dependencies.after);
      if(publicationReferences){const {completeContentReferences}=await import('../../relations/content-input.ts');completeContentReferences(publicationReferences,value.type);}
      return hydratedBylines(published);
    },
    async scheduleContent(input:unknown,currentTime:Date=new Date()):Promise<ContentItem> {
      const actor=mutationPermission('content:publish_own','content:publish_any');const raw=object(input);const value=key(raw);
      const item=await stored(value,raw.locale===undefined,true);owner(item,actor,'content:publish_any');precondition(value.expected,item);
      const collection=await definition(value.type);
      if(collection.routable&&!item.slug?.trim())throw new CmsError('VALIDATION_ERROR','Cannot publish routable content without a slug');
      return hydratedBylines(await translate(()=>content.schedule(value.type,item.id,value.scheduledAt,currentTime,{version:item.version,updatedAt:item.updatedAt})));
    },
    async unscheduleContent(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:publish_own','content:publish_any');const raw=object(input);const value=key(raw);
      const item=await stored(value,raw.locale===undefined,true);owner(item,actor,'content:publish_any');precondition(value.expected,item);
      return hydratedBylines(await translate(()=>content.unschedule(value.type,item.id,{version:item.version,updatedAt:item.updatedAt})));
    },
    async unpublish(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:publish_own','content:publish_any');const value=key(input);const item=await stored(value);
      owner(item,actor,'content:publish_any');precondition(value.expected,item);
      const unpublished=await translate(()=>content.unpublish(value.type,value.id,{version:item.version,updatedAt:item.updatedAt}));
      // Source cleanup consumes the actual queued boundary, including work
      // already pending for an existing draft. This host binds that consumer
      // to request-lifetime work; conditional acknowledgement preserves a
      // newer queue write while the task is deferred.
      try {
        const queued=(await sql<{revision_id:string}>`SELECT revision_id FROM _cms_revision_prune_queue
          WHERE collection=${value.type} AND entry_id=${value.id}`.execute(database.db)).rows[0];
        if(queued)prune(value.type,value.id,queued.revision_id);
      } catch(error) {
        // The accepted mutation already committed. A bookkeeping read or host
        // scheduling failure must leave its result intact and queue retryable.
        console.error(`[revisions] Failed to schedule pruning for ${value.type}/${value.id}:`,error);
      }
      return hydratedBylines(unpublished);
    },
    async discardDraft(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:edit_own','content:edit_any');const value=key(input);const item=await stored(value);
      owner(item,actor,'content:edit_any');precondition(value.expected,item);
      return hydratedBylines(await translate(()=>content.discardDraft(value.type,value.id,{version:item.version,updatedAt:item.updatedAt})));
    },
    async listRevisions(input:unknown):Promise<Revision[]> {
      requirePermission('content:read');requirePermission('content:read_drafts');const value=key(input);await stored(value);
      return revisions.findVisibleByEntry(value.type,value.id,{limit:value.limit});
    },
    async restoreRevision(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:edit_own','content:edit_any');const value=object(input);
      const revision=await revisions.findById(parse(entryId,value.revisionId));if(!revision)throw new CmsError('NOT_FOUND');
      if(value.type!==undefined&&value.type!==revision.collection||value.id!==undefined&&value.id!==revision.entryId)throw new CmsError('NOT_FOUND');
      const contentKey={type:revision.collection,id:revision.entryId,locale:parse(localeInput,value.locale??'en')};const item=await stored(contentKey);
      owner(item,actor,'content:edit_any');precondition(value.expected,item);const collection=await definition(revision.collection);
      const restored={...revision.data};delete restored._referencesBaseline;
      return translate(async()=>{
        if(collection.supports.includes('revisions')){
          const revisionId=await content.restoreDraftRevision(revision.collection,revision.entryId,restored,actor.id,{version:item.version,updatedAt:item.updatedAt});
          if(!revisionId)throw new CmsError('NOT_FOUND');prune(revision.collection,revision.entryId,revisionId);return hydrate(await stored(contentKey));
        }
        const result=await content.restoreRevision(revision.collection,revision.entryId,restored,actor.id,{version:item.version,updatedAt:item.updatedAt});prune(revision.collection,revision.entryId,result.revisionId);return hydrate(result.item);
      });
    },
    /** Public repository read: literal published status, live columns, no draft hydration. */
    async readPublished(input:unknown):Promise<ContentItem|null> {
      const value=key(input);const item=await content.findById(value.type,value.id);
      return item?.status==='published'&&item.locale===value.locale?hydratedBylines(item):null;
    }
  };
}
