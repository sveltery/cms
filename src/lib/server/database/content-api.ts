// Source-shaped trusted application API over the single Native content owner.
// EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e content handlers.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {CmsError,type CmsDatabase} from './contract.ts';
import type {ServerPrincipal} from './service.ts';
import type {LifecycleDependencies} from './lifecycle/upstream/host.ts';
import {lifecycleService,type ContentCreationAttribution} from './lifecycle/service.ts';
import {LifecycleSlugConflictError} from './lifecycle/errors.ts';
import {encodeRev,validateRev} from './lifecycle/upstream/api/rev.ts';
import {ContentCollectionNotFoundError,EmDashValidationError,InvalidCursorError,type ContentItem} from './lifecycle/upstream/database/repositories/types.ts';
import {isMissingColumnError,isMissingTableError} from './lifecycle/upstream/utils/db-errors.ts';

type Body=Record<string,any>;
function receipt(item:ContentItem){return{success:true as const,data:{item,_rev:encodeRev(item)}};}
function failure(cause:unknown,operation:string,collection:string){
 if(operation==='LIST'){
  if(cause instanceof InvalidCursorError)return{success:false as const,error:{code:'INVALID_CURSOR',message:cause.message}};
  if(cause instanceof ContentCollectionNotFoundError||isMissingTableError(cause))return{success:false as const,error:{code:'COLLECTION_NOT_FOUND',message:`Collection '${collection}' not found`}};
  if(isMissingColumnError(cause,'deleted_at'))return{success:false as const,error:{code:'COLLECTION_SCHEMA_MISMATCH',message:`Collection '${collection}' backing table is missing the 'deleted_at' column`}};
 }
 if(cause instanceof CmsError||cause instanceof LifecycleSlugConflictError)return{success:false as const,error:{code:cause.code,message:cause.message}};
 if(cause instanceof EmDashValidationError)return{success:false as const,error:{code:'VALIDATION_ERROR',message:cause.message}};
 return{success:false as const,error:{code:`CONTENT_${operation}_ERROR`,message:`Failed to ${operation.toLowerCase()} content`}};
}

/** Identity and Source list semantics are fixed by this trusted constructor.
 * Public request bodies never provide either constructor policy or identity. */
export function nativeContentApi(database:CmsDatabase,principal:ServerPrincipal|null,dependencies:LifecycleDependencies={},creationAttribution?:ContentCreationAttribution){
 const owner=lifecycleService(database,principal,dependencies,creationAttribution);
 const get=(collection:string,id:string,locale?:string)=>owner.getContent({type:collection,id,...(locale===undefined?{}:{locale})},{inferLocale:locale===undefined,resolveIdentifier:true});
 async function mutation(collection:string,id:string,body:Body,operation:(input:Body)=>Promise<ContentItem>){
  const item=await get(collection,id,body.locale);const validation=validateRev(body._rev,item);
  if(!validation.valid)throw new CmsError('CONFLICT',validation.message);
  const {_rev,...values}=body;
  return operation({...values,type:collection,id:item.id,locale:item.locale,expected:{version:item.version,updatedAt:item.updatedAt}});
 }
 return{
  async create(collection:string,body:Body){try{
   // Pinned core handler forwards metadata independently of authenticated actor;
   // repository create stores authorId || null and performs no user-row lookup.
   const creator=lifecycleService(database,principal,dependencies,creationAttribution??{authorId:body.authorId});
   let item=await creator.createContent({...body,type:collection,status:body.status==='published'?undefined:body.status});
   // Native public creation retains its established draft/publication CAS.
   // This two-write transport is documented separately from Source atomicity.
   if(body.status==='published')item=await owner.publish({type:collection,id:item.id,locale:item.locale,publishedAt:body.publishedAt,expected:{version:item.version,updatedAt:item.updatedAt}});
   return receipt(item);
  }catch(cause){return failure(cause,'CREATE',collection);}},
  async get(collection:string,id:string,locale?:string){try{return receipt(await get(collection,id,locale));}catch(cause){return failure(cause,'GET',collection);}},
  async update(collection:string,id:string,body:Body){try{return receipt(await mutation(collection,id,body,async input=>(await owner.updateContent(input)).item));}catch(cause){return failure(cause,'UPDATE',collection);}},
  async list(collection:string,options:Body={}){try{return{success:true as const,data:await owner.listContent({...options,type:collection},{allLocales:true,sourceSchemaDiscovery:true})};}catch(cause){return failure(cause,'LIST',collection);}},
  async publish(collection:string,id:string,options:Body={}){try{return receipt(await mutation(collection,id,options,input=>owner.publish(input)));}catch(cause){return failure(cause,'PUBLISH',collection);}},
  async duplicate(collection:string,id:string){try{return receipt(await owner.duplicateContent({type:collection,id}));}catch(cause){return failure(cause,'DUPLICATE',collection);}},
  async schedule(collection:string,id:string,scheduledAt:string,currentTime:Date=new Date(),_rev?:string){try{return receipt(await mutation(collection,id,{scheduledAt,_rev},input=>owner.scheduleContent(input,currentTime)));}catch(cause){return failure(cause,'SCHEDULE',collection);}},
  async unschedule(collection:string,id:string,_rev?:string){try{return receipt(await mutation(collection,id,{_rev},input=>owner.unscheduleContent(input)));}catch(cause){return failure(cause,'UNSCHEDULE',collection);}},
  async permanentDelete(collection:string,id:string){try{await owner.permanentDeleteContent({type:collection,id});return{success:true as const,data:{deleted:true}};}catch(cause){return failure(cause,'PERMANENT_DELETE',collection);}}
 };
}
