import { sql, type CompiledQuery } from 'kysely';
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
import * as v from 'valibot';

// Runtime draft-stage, hydration and retention algorithms adapted from
// EmDashRuntime.handleContentUpdate:3538,hydrateDraftData:3257 and revision
// restore:4974 at immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
const DRAFT_ONLY_UPDATE_KEYS = new Set(['data','slug','locale','skipRevision','references','actor','migrateBlocks','replaceBlocks']);
const UNSUPPORTED = ['seo','taxonomies','references','bylines','actor','migrateBlocks','replaceBlocks','translationOf','inheritFields'];
export interface ContentKey {type:string;id:string;locale?:string}
export interface ContentMutation extends ContentKey {expected?:RevisionPrecondition}
export interface ContentUpdate extends ContentMutation {
  data?:Record<string,unknown>;slug?:string|null;skipRevision?:boolean;publishedAt?:string|null;
}
export interface ContentReceipt {item:ContentItem;liveContentChanged:boolean}

/** Compose only with trusted authentication; input never supplies identity. */
export function lifecycleService(database:CmsDatabase, principal:ServerPrincipal|null, dependencies:LifecycleDependencies={}) {
  registerLifecycleDatabase(database,dependencies);
  const identity=principal&&typeof principal.id==='string'&&principal.id.length>0&&principal.id.length<=128&&Array.isArray(principal.permissions)
    ? {id:principal.id,permissions:new Set<string>(principal.permissions)} : null;
  const registry=new SchemaRegistry(database);
  const drafts=new DraftRepository(database);
  const content=new ContentRepository(database.db as any);
  const revisions=new RevisionRepository(database.db as any);
  const datetimes=new ContentDatetimeNormalizer(database.db as any);
  function authenticated() {if(!identity)throw new CmsError('UNAUTHENTICATED');return identity;}
  function requirePermission(permission:string) {const actor=authenticated();if(!actor.permissions.has(permission))throw new CmsError('FORBIDDEN');return actor;}
  function mutationPermission(own:string,any:string) {
    const actor=authenticated();if(!actor.permissions.has(own)&&!actor.permissions.has(any))throw new CmsError('FORBIDDEN');return actor;
  }
  function object(input:unknown):Record<string,any> {
    if(!input||typeof input!=='object'||Array.isArray(input))throw new CmsError('VALIDATION_ERROR');
    const value=input as Record<string,any>;
    for(const key of UNSUPPORTED)if(value[key]!==undefined)throw new CmsError('VALIDATION_ERROR',`Lifecycle capability '${key}' is not implemented`);
    if(value.slug!==undefined)parse(v.nullable(v.pipe(v.string(),v.maxLength(200))),value.slug);
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
  async function stored(value:ContentKey) {
    await definition(value.type);
    const item=await content.findById(value.type,value.id);
    if(!item||item.locale!==(value.locale??'en'))throw new CmsError('NOT_FOUND');return item;
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
    if(!item.draftRevisionId)return item;
    const revision=await revisions.findById(item.draftRevisionId);
    if(!revision)return item;
    const draftData:Record<string,unknown>={};
    for(const [field,value]of Object.entries(revision.data))if(!field.startsWith('_'))draftData[field]=value;
    return {...item,data:{...item.data,...draftData},liveData:item.data};
  }
  function prune(collection:string,id:string,revisionId:string) {
    const task=async()=>{await revisions.pruneQueuedEntry(collection,id,revisionId,50);};
    if(dependencies.after)dependencies.after(task);
    else void task().catch(error=>console.error(`[revisions] Failed to prune revisions for ${collection}/${id}:`,error));
  }
  async function translate<T>(operation:()=>Promise<T>):Promise<T> {
    try{return await operation();}
    catch(cause){
      if(cause instanceof ContentMutationConflictError)throw new CmsError('CONFLICT',cause.message);
      if(cause instanceof EmDashValidationError)throw new CmsError('VALIDATION_ERROR',cause.message);
      throw cause;
    }
  }
  async function atomicUpdate(value:ReturnType<typeof key>,item:ContentItem,input:Record<string,any>,data:Record<string,unknown>|undefined,anyPermission:string) {
    const actor=authenticated();const assignments=[];
    if(data!==undefined)for(const[field,contentValue]of Object.entries(data))assignments.push(sql`${sql.ref(field)}=${serializeValue(contentValue)}`);
    if(input.slug!==undefined)assignments.push(sql`slug=${input.slug}`);
    if(input.status!==undefined)assignments.push(sql`status=${input.status}`);
    if(input.publishedAt!==undefined)assignments.push(sql`published_at=${input.publishedAt===null?null:await translate(()=>datetimes.normalizeValue(value.type,input.publishedAt))}`);
    if(assignments.length)assignments.push(sql`updated_at=${new Date().toISOString()}`);
    assignments.push(sql`version=version+1`);
    const collection=await definition(value.type);const token=ulid();
    const statements:CompiledQuery[]=[
      sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN EXISTS(SELECT 1 FROM _cms_collections WHERE id=${collection.id} AND version=${collection.version})THEN 1 ELSE 0 END`.compile(database.db),
      sql`UPDATE ${sql.ref(tableName(value.type))} SET ${sql.join(assignments)} WHERE id=${value.id} AND locale=${value.locale}
        AND deleted_at IS NULL AND version=${item.version} AND updated_at=${item.updatedAt}
        ${actor.permissions.has(anyPermission)?sql``:sql`AND author_id=${actor.id}`} RETURNING *`.compile(database.db),
      sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db)
    ];
    let results;
    try{results=await database.atomicBatch(statements);}
    catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
    const row=results[1]?.rows[0] as Record<string,unknown>|undefined;
    if(!row)throw new CmsError('CONFLICT');
    return content.mapRow(value.type,row);
  }
  return {
    async createContent(input:unknown):Promise<ContentItem> {
      const actor=requirePermission('content:create');const value=object(input);
      const type=parse(identifier,value.type);const locale=parse(localeInput,value.locale??'en');
      if(value.status!==undefined&&value.status!=='draft')throw new CmsError('VALIDATION_ERROR','Create a draft, then publish it');
      const collection=await definition(type);
      const data=normalizeBlankArrays(parse(schemaData,value.data),collection.fields);
      const slug=value.slug===undefined?await content.generateUniqueSlug(type,typeof data.title==='string'?data.title:'',locale):value.slug;
      const item=await drafts.create({type,locale,data,slug},actor.id);
      return stored({type,id:item.id,locale});
    },
    async getContent(input:unknown):Promise<ContentItem> {
      requirePermission('content:read');requirePermission('content:read_drafts');return hydrate(await stored(key(input)));
    },
    async listContent(input:unknown) {
      requirePermission('content:read');requirePermission('content:read_drafts');const value=object(input);
      const type=parse(identifier,value.type);const locale=parse(localeInput,value.locale??'en');await definition(type);
      if(value.status!==undefined&&typeof value.status!=='string')throw new CmsError('VALIDATION_ERROR');
      if(value.limit!==undefined&&(!Number.isSafeInteger(value.limit)||value.limit<1))throw new CmsError('VALIDATION_ERROR');
      return content.findMany(type,{limit:value.limit,cursor:value.cursor,where:{locale,...(value.status===undefined?{}:{status:value.status})}});
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
      const usesDraftRevisions=data!==undefined&&collection.supports.includes('revisions');
      const liveMetaTouched=Object.entries(value).some(([field,fieldValue])=>fieldValue!==undefined&&!['type','id','expected','_rev'].includes(field)&&!DRAFT_ONLY_UPDATE_KEYS.has(field));
      if(usesDraftRevisions){
        for(let attempt=0;attempt<32;attempt++){
          owner(existing,actor,'content:edit_any');precondition(value.expected,existing);
          const base=existing.draftRevisionId?(await revisions.findById(existing.draftRevisionId))?.data??existing.data:existing.data;
          const merged=keepKnownFields({...base,...data},fields);if(value.slug!==undefined)merged._slug=value.slug;
          const revision=await revisions.create({collection:value.type,entryId:value.id,data:merged,authorId:actor.id});
          let staged;
          try{staged=await content.replaceDraftRevision(value.type,value.id,revision.id,existing);}
          catch(cause){await revisions.deleteIfUnreferenced(value.type,value.id,revision.id);throw cause;}
          if(!staged){
            await revisions.deleteIfUnreferenced(value.type,value.id,revision.id);
            if(value.expected!==undefined||attempt===31)throw new CmsError('CONFLICT');existing=await stored(value);continue;
          }
          if(value.skipRevision&&existing.draftRevisionId)await revisions.deleteIfUnreferenced(value.type,value.id,existing.draftRevisionId);
          else prune(value.type,value.id,revision.id);
          let item=await stored(value);
          if(liveMetaTouched)item=await atomicUpdate(value,item,{...value,slug:undefined},undefined,'content:edit_any');
          return {item:await hydrate(item),liveContentChanged:liveMetaTouched};
        }
        throw new CmsError('CONFLICT');
      }
      const item=await atomicUpdate(value,existing,value,data,'content:edit_any');
      return {item:await hydrate(item),liveContentChanged:Boolean(data||value.slug!==undefined||liveMetaTouched)};
    },
    async publish(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:publish_own','content:publish_any');const value=key(input);const item=await stored(value);
      owner(item,actor,'content:publish_any');precondition(value.expected,item);const collection=await definition(value.type);
      publicationDatePermission(value);
      return translate(()=>content.publish(value.type,value.id,value.publishedAt,false,undefined,collection.supports.includes('revisions'),collection.routable,{version:item.version,updatedAt:item.updatedAt}));
    },
    async unpublish(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:publish_own','content:publish_any');const value=key(input);const item=await stored(value);
      owner(item,actor,'content:publish_any');precondition(value.expected,item);
      return translate(()=>content.unpublish(value.type,value.id,{version:item.version,updatedAt:item.updatedAt}));
    },
    async discardDraft(input:unknown):Promise<ContentItem> {
      const actor=mutationPermission('content:edit_own','content:edit_any');const value=key(input);const item=await stored(value);
      owner(item,actor,'content:edit_any');precondition(value.expected,item);
      return translate(()=>content.discardDraft(value.type,value.id,{version:item.version,updatedAt:item.updatedAt}));
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
      return item?.status==='published'&&item.locale===value.locale?item:null;
    }
  };
}
