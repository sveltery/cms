import {sql,type CompiledQuery} from 'kysely';
import {ulid} from 'ulidx';
import {deserializeValue} from './field-value.ts';
import {CmsError,type CmsDatabase,type DraftEntry,type DraftSummary} from './contract.ts';
import type {ServerPrincipal,Permission} from './service.ts';
import {SchemaRegistry} from './registry.ts';
import {ContentRepository} from './lifecycle/upstream/database/repositories/content.ts';
import {RevisionRepository} from './lifecycle/upstream/database/repositories/revision.ts';
import {EmDashValidationError,ContentCollectionNotFoundError,InvalidCursorError,type ContentItem,type FindManyOptions} from './lifecycle/upstream/database/repositories/types.ts';
import {InvalidCursorError as NativeInvalidCursorError} from './trash-cursor.ts';
import {lifecycleService} from './lifecycle/service.ts';
import type {LifecycleDependencies} from './lifecycle/upstream/host.ts';
import {genericContentList,genericContentUpdate} from './content-validation.ts';
import {countTrashedDraftInput,deleteDraftInput,getDraftInput,getTrashedDraftInput,listTrashedDraftInput,parse,restoreDraftInput,tableName} from './validation.ts';

// Pinned EmDashRuntime and content handlers/repository at
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright 2026 Cloudflare Inc.
// MIT; notices/emdash-MIT.txt. Native bounded summaries and mandatory caller CAS
// preserve this CMS's existing transport boundary; see docs/content-composition.md.
export function ordinaryContentService(database:CmsDatabase,principal:ServerPrincipal|null,dependencies:LifecycleDependencies={}){
 const actor=principal&&typeof principal.id==='string'&&principal.id.length>0&&principal.id.length<=128&&Array.isArray(principal.permissions)?{id:principal.id,permissions:[...principal.permissions]}:null;
 const registry=new SchemaRegistry(database);
 let storedRepository:ContentRepository|undefined;let storedRevisions:RevisionRepository|undefined;let storedLifecycle:ReturnType<typeof lifecycleService>|undefined;
 const repository=()=>storedRepository??=new ContentRepository(database.db as any);
 const revisions=()=>storedRevisions??=new RevisionRepository(database.db as any);
 const lifecycle=()=>storedLifecycle??=lifecycleService(database,actor,dependencies);
 function permission(name:Permission){if(!actor)throw new CmsError('UNAUTHENTICATED');if(!actor.permissions.includes(name))throw new CmsError('FORBIDDEN');return actor;}
 function read(){permission('content:read');permission('content:read_drafts');}
 function mutation(own:Permission,any:Permission){if(!actor)throw new CmsError('UNAUTHENTICATED');if(!actor.permissions.includes(own)&&!actor.permissions.includes(any))throw new CmsError('FORBIDDEN');return actor;}
 function owner(item:ContentItem,any:Permission){if(!actor?.permissions.includes(any)&&item.authorId!==actor?.id)throw new CmsError('FORBIDDEN');}
 async function definition(type:string){const collection=await registry.getCollectionWithFields(type);if(!collection)throw new CmsError('NOT_FOUND');return collection;}
 function entry(item:ContentItem):ContentItem&DraftEntry{if(typeof item.locale!=='string')throw new CmsError('VALIDATION_ERROR','Persisted content locale is missing');return{...item,locale:item.locale};}
 function nativeRow(type:string,row:Record<string,unknown>,fields:Array<{slug:string}>):ContentItem{
  const data=Object.fromEntries(fields.filter(field=>Object.hasOwn(row,field.slug)).map(field=>[field.slug,deserializeValue(row[field.slug])]));
  return {...repository().mapRow(type,row),data};
 }
 async function hydrate(item:ContentItem):Promise<ContentItem&DraftEntry>{
  const stored=entry(item);if(!item.draftRevisionId)return stored;
  try{
   const revision=await revisions().findById(item.draftRevisionId);if(!revision)return stored;
   const draftData=Object.fromEntries(Object.entries(revision.data).filter(([key])=>!key.startsWith('_')));
   return {...stored,data:{...item.data,...draftData},liveData:item.data};
  }catch(cause){
   // Pinned EmDashRuntime.hydrateDraftData uses this non-strict read fallback.
   // Base-row/schema lookup and locale validation remain outside this catch.
   console.error('[emdash] draft hydration failed:',cause);
   return stored;
  }
 }
 async function hydrateReferences(item:ContentItem):Promise<ContentItem&DraftEntry>{
  const collection=await definition(item.type);
  if(collection.fields.some(field=>field.type==='reference'&&field.validation?.relation))
   await (await import('../relations/content-read.ts')).hydrateContentReferences(database,item,true);
  return entry(item);
 }
 function summary(item:ContentItem,titleField='title'):DraftSummary{
  const {data,liveData,...value}=entry(item);const title=data[titleField];return{...value,title:typeof title==='string'?title.slice(0,200):null};
 }
 async function translate<T>(run:()=>Promise<T>):Promise<T>{
  try{return await run();}catch(cause){
   if(cause instanceof EmDashValidationError)throw new CmsError('VALIDATION_ERROR',cause.message);
   if(cause instanceof ContentCollectionNotFoundError)throw new CmsError('NOT_FOUND');
   if(cause instanceof InvalidCursorError)throw new NativeInvalidCursorError('invalid-cursor');
   throw cause;
  }
 }
 // Pinned content.ts normalizeDateBound:844; date-only upper bounds include
 // the complete day. Stray bounds without dateField are ignored upstream.
 function bound(value:string|undefined,edge:'start'|'end'){
  if(!value)return undefined;if(/^\d{4}-\d{2}-\d{2}$/.test(value))return `${value}T${edge==='start'?'00:00:00.000':'23:59:59.999'}Z`;
  const date=new Date(value);if(Number.isNaN(date.getTime()))throw new CmsError('VALIDATION_ERROR');return date.toISOString();
 }
 async function listOptions(input:unknown){
  // Check existence before resolving indexed filter errors, as the pin does.
  const value=parse(genericContentList,input);const collection=await definition(value.type);
  const where:FindManyOptions['where']={locale:value.locale};
  if(value.status)where.status=value.status;if(value.authorId)where.authorId=value.authorId;
  if(value.fieldFilters&&Object.keys(value.fieldFilters).length)where.fieldFilters=value.fieldFilters as any;
  if(value.dateField&&(value.dateFrom||value.dateTo))where.dateFilter={field:value.dateField,from:bound(value.dateFrom,'start'),to:bound(value.dateTo,'end')};
  return{value,collection,options:{limit:value.limit,cursor:value.cursor,where,
   ...(value.orderBy?{orderBy:{field:value.orderBy,direction:value.order??'desc'}}:{}),
   sortableExtras:[collection.titleField,collection.dateField].filter((field):field is string=>Boolean(field))}satisfies FindManyOptions};
 }
 async function includingTrashed(type:string,id:string,locale?:string){
  const collection=await definition(type);
  const row=(await sql<Record<string,unknown>>`SELECT * FROM ${sql.ref(tableName(type))} WHERE id=${id}
   ${locale===undefined?sql``:sql`AND locale=${locale}`}`.execute(database.db)).rows[0];
  if(!row)throw new CmsError('NOT_FOUND');return{...nativeRow(type,row,collection.fields),deletedAt:typeof row.deleted_at==='string'?row.deleted_at:null};
 }
 async function guarded(collection:{id:string;version:number},query:CompiledQuery){
  const token=ulid();try{return await database.atomicBatch([
   sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN EXISTS(SELECT 1 FROM _cms_collections WHERE id=${collection.id} AND version=${collection.version}) THEN 1 ELSE 0 END`.compile(database.db),
   query,sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db)
  ]);}catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1|UNIQUE constraint failed:/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
 }
 return{
  async createContent(input:unknown){permission('content:create');return entry(await lifecycle().createContent(input));},
  async getContent(input:unknown){read();const value=parse(getDraftInput,input);const item=await includingTrashed(value.type,value.id,value.locale);if(item.deletedAt)throw new CmsError('NOT_FOUND');const {deletedAt,...active}=item;return hydrateReferences(await hydrate(active));},
  async updateContent(input:unknown){
   mutation('content:edit_own','content:edit_any');
   // Preserve required caller CAS and JSON/slug bounds. Omitted data remains
   // absent so the shared lifecycle can select its live-metadata save path.
   const source=input as Record<string,unknown>;const {skipRevision,...value}=source??{};
   if(skipRevision!==undefined&&typeof skipRevision!=='boolean')throw new CmsError('VALIDATION_ERROR');
   const parsed=parse(genericContentUpdate,value);return entry((await lifecycle().updateContent({...parsed,...(skipRevision===undefined?{}:{skipRevision})})).item);
  },
  async listContent(input:unknown){read();const {value,collection,options}=await listOptions(input);
   const result=await translate(()=>repository().findMany(value.type,options));return{...result,items:result.items.map(item=>summary(item,collection.titleField??'title'))};
  },
  async countContent(input:unknown){read();const {value,options}=await listOptions(input);return translate(()=>repository().count(value.type,options.where));},
  async getTrashedContent(input:unknown){read();const value=parse(getTrashedDraftInput,input);const item=await includingTrashed(value.type,value.id,value.locale);
   if(!item.deletedAt)throw new CmsError('NOT_FOUND');return{...await hydrate(item),deletedAt:item.deletedAt};
  },
  async listTrashedContent(input:unknown){read();const {type,locale,...options}=parse(listTrashedDraftInput,input);const collection=await definition(type);
   const result=await translate(()=>repository().findTrashed(type,{...options,where:{locale}}));return{...result,items:result.items.map(item=>({...summary(item,collection.titleField??'title'),deletedAt:item.deletedAt}))};
  },
  async countTrashedContent(input:unknown){read();const {type,locale}=parse(countTrashedDraftInput,input);await definition(type);return repository().countTrashed(type,{locale});},
  async deleteContent(input:unknown){
   const identity=mutation('content:delete_own','content:delete_any');const value=parse(deleteDraftInput,input);
   const item=await includingTrashed(value.type,value.id,value.locale);if(item.deletedAt)throw new CmsError('NOT_FOUND');owner(item,'content:delete_any');
   const collection=await definition(value.type);const now=new Date().toISOString();
   const query=sql`UPDATE ${sql.ref(tableName(value.type))} SET deleted_at=${now},updated_at=${now},version=version+1
    WHERE id=${value.id} AND locale=${value.locale} AND deleted_at IS NULL AND version=${value.expected.version} AND updated_at=${value.expected.updatedAt}
    ${identity.permissions.includes('content:delete_any')?sql``:sql`AND author_id=${identity.id}`} RETURNING id`.compile(database.db);
   const results=await guarded(collection,query);if(!results[1]?.rows.length)throw new CmsError('CONFLICT');
  },
  async restoreContent(input:unknown){
   const identity=mutation('content:edit_own','content:edit_any');const value=parse(restoreDraftInput,input);
   const item=await includingTrashed(value.type,value.id,value.locale);owner(item,'content:edit_any');
   const collection=await definition(value.type);const now=new Date(Math.max(Date.now(),Date.parse(value.expected.updatedAt)+1)).toISOString();
   const query=sql<Record<string,unknown>>`UPDATE ${sql.ref(tableName(value.type))} SET deleted_at=NULL,live_revision_id=NULL,scheduled_at=NULL,status='draft',updated_at=${now},version=version+1
    WHERE id=${value.id} AND locale=${value.locale} AND deleted_at IS NOT NULL AND version=${value.expected.version} AND updated_at=${value.expected.updatedAt}
    ${identity.permissions.includes('content:edit_any')?sql``:sql`AND author_id=${identity.id}`} RETURNING *`.compile(database.db);
   const results=await guarded(collection,query);const row=results[1]?.rows[0] as Record<string,unknown>|undefined;if(!row)throw new CmsError('CONFLICT');
   return hydrate(nativeRow(value.type,row,collection.fields));
  }
 };
}
