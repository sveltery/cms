// Source-shaped content bridge for taxonomy selections. Actual Native content
// mutations remain in the single ordinary/lifecycle content owner.
// EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e content.ts1174/1455/2806.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type {Kysely} from 'kysely';
import {CmsError,type CmsDatabase} from '../database/contract.ts';
import {lifecycleService} from '../database/lifecycle/service.ts';
import type {ServerPrincipal} from '../database/service.ts';
import type {LifecycleDependencies} from '../database/lifecycle/upstream/host.ts';
import {EmDashValidationError,type ContentItem} from '../database/lifecycle/upstream/database/repositories/types.ts';
import {encodeRev,validateRev} from '../database/lifecycle/upstream/api/rev.ts';
import type {ApiResult} from '../menus/api-types.ts';
import type {Database} from './database-types.ts';
import {taxonomyStorage} from './write-plan.ts';
import {resolveConfiguredLocale} from '../menus/i18n-config.ts';

export interface TaxonomyContentBody {
 data?:Record<string,unknown>;slug?:string|null;locale?:string;
 taxonomies?:Record<string,string[]>;_rev?:string;
}
export interface TaxonomyContentResponse {item:ContentItem;_rev:string}
/** Explicit trusted constructor host. A reference fixture must supply its real
 * physical owner; neither environment selection nor callback emulation exists. */
export interface TaxonomyContentHost {
 readonly database:object;
 get(collection:string,id:string,locale?:string):Promise<ContentItem>;
 create(collection:string,body:TaxonomyContentBody):Promise<ContentItem>;
 update(collection:string,id:string,body:TaxonomyContentBody):Promise<ContentItem>;
}
export function nativeTaxonomyContentHost(db:Kysely<Database>,storage:CmsDatabase,principal:ServerPrincipal|null,dependencies:LifecycleDependencies={}):TaxonomyContentHost {
 if(taxonomyStorage(db)!==storage)throw new Error('Content and taxonomy physical owners differ');
 const service=lifecycleService(storage,principal,dependencies);
 return {database:db,
  get:(collection,id,locale)=>service.getContent({type:collection,id,...(locale===undefined?{}:{locale:resolveConfiguredLocale(locale)})},{inferLocale:locale===undefined,resolveIdentifier:true}),
  create:(collection,body)=>service.createContent({...body,type:collection}),
  async update(collection,id,body){
   const {_rev,...values}=body;
   const existing=await service.getContent({type:collection,id,...(body.locale===undefined?{}:{locale:resolveConfiguredLocale(body.locale)})},{inferLocale:body.locale===undefined,resolveIdentifier:true});
   const check=validateRev(_rev,existing);if(!check.valid)throw new CmsError('CONFLICT',check.message);
   return (await service.updateContent({...values,type:collection,id:existing.id,locale:existing.locale,
    expected:{version:existing.version,updatedAt:existing.updatedAt}})).item;
  }
 };
}
function requireHost(db:object,host:TaxonomyContentHost|undefined):TaxonomyContentHost {
 if(!host||host.database!==db)throw new Error('Content mutation requires its explicit physical owner');
 return host;
}
function failure(cause:unknown,operation:'CREATE'|'UPDATE'|'GET'):ApiResult<TaxonomyContentResponse> {
 if(cause instanceof CmsError)return{success:false,error:{code:cause.code,message:cause.message}};
 if(cause instanceof EmDashValidationError)return{success:false,error:{code:'VALIDATION_ERROR',message:cause.message}};
 console.error(`Content ${operation.toLowerCase()} error:`,cause);
 return{success:false,error:{code:`CONTENT_${operation}_ERROR`,message:`Failed to ${operation.toLowerCase()} content`}};
}
export async function handleContentCreate(db:Kysely<Database>,collection:string,body:TaxonomyContentBody,host?:TaxonomyContentHost):Promise<ApiResult<TaxonomyContentResponse>> {
 try{const item=await requireHost(db,host).create(collection,body);return{success:true,data:{item,_rev:encodeRev(item)}};}
 catch(cause){return failure(cause,'CREATE');}
}
export async function handleContentUpdate(db:Kysely<Database>,collection:string,id:string,body:TaxonomyContentBody,host?:TaxonomyContentHost):Promise<ApiResult<TaxonomyContentResponse>> {
 try{const item=await requireHost(db,host).update(collection,id,body);return{success:true,data:{item,_rev:encodeRev(item)}};}
 catch(cause){return failure(cause,'UPDATE');}
}

/** Genuine owner read used by taxonomy assignment routes; this bridge does not
 * claim generic Source SEO/byline/reference hydration or public QueryCore. */
export async function handleContentGet(db:Kysely<Database>,collection:string,id:string,locale?:string,host?:TaxonomyContentHost):Promise<ApiResult<TaxonomyContentResponse>> {
 try{const item=await requireHost(db,host).get(collection,id,locale);return{success:true,data:{item,_rev:encodeRev(item)}};}
 catch(cause){return failure(cause,'GET');}
}
