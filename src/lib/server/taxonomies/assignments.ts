// Pinned EmDash content/[collection]/[id]/terms/[taxonomy] assignment response.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { Kysely } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from './database-types.ts';
import { ContentRepository } from '../database/lifecycle/upstream/database/repositories/content.ts';
import { TaxonomyRepository, type TaxonomyAssignmentResolution } from './repository.ts';
import { getI18nConfig } from '../menus/i18n-config.ts';
import { invalidateTermCache } from './index.ts';
import type { ApiResult } from '../menus/api-types.ts';
import { taxonomyCacheInvalidator } from './cache.ts';
import { taxonomyTag } from '../sections-widgets/chrome-tags.ts';
import { chunks } from '../database/lifecycle/upstream/utils/chunks.ts';

function assignmentResponse(assignments: TaxonomyAssignmentResolution[], entryLocale: string) {
 const config=getI18nConfig(); const defaultLocale=config?.defaultLocale??'en';
 return {
  terms: assignments.flatMap(({term})=>term?[{id:term.id,name:term.name,slug:term.slug,label:term.label,
    parentId:term.parentId,locale:term.locale,translationGroup:term.translationGroup}]:[]),
  unresolved: assignments.filter(({term})=>term===null).map(({translationGroup,availableLocales,translations})=>({translationGroup,availableLocales,translations})),
  entryLocale,defaultLocale,implicitDefaultLocale:config===null
 };
}
export async function entryForTaxonomyAssignment(storage:CmsDatabase,collection:string,id:string) {
 return new ContentRepository(storage.db as any).findByIdOrSlug(collection,id);
}
export async function getEntryTaxonomyAssignments(db:Kysely<Database>,storage:CmsDatabase,collection:string,id:string,taxonomy:string):Promise<ApiResult<ReturnType<typeof assignmentResponse>>> {
 const entry=await entryForTaxonomyAssignment(storage,collection,id);
 if(!entry)return {success:false,error:{code:'NOT_FOUND',message:'Content not found'}};
 const locale=entry.locale||getI18nConfig()?.defaultLocale||'en';
 const assignments=await new TaxonomyRepository(db).getTermAssignmentsForEntry(collection,entry.id,taxonomy,locale,getI18nConfig()?.defaultLocale??'en');
 return {success:true,data:assignmentResponse(assignments,locale)};
}
/** Validation and group semantics from the whole Source assignment endpoint. */
export async function setEntryTaxonomyAssignments(db:Kysely<Database>,storage:CmsDatabase,collection:string,id:string,taxonomy:string,termIds:string[]):Promise<ApiResult<ReturnType<typeof assignmentResponse>>> {
 const entry=await entryForTaxonomyAssignment(storage,collection,id);
 if(!entry)return {success:false,error:{code:'NOT_FOUND',message:'Content not found'}};
 const repo=new TaxonomyRepository(db);
 for(const termId of termIds){
  const term=await repo.findById(termId);
  if(!term)return {success:false,error:{code:'NOT_FOUND',message:`Term ID '${termId}' not found`}};
  if(term.name!==taxonomy)return {success:false,error:{code:'VALIDATION_ERROR',message:`Term ID '${termId}' does not belong to taxonomy '${taxonomy}'`}};
 }
 await repo.setTermsForEntry(collection,entry.id,taxonomy,termIds); invalidateTermCache();
 const invalidate=taxonomyCacheInvalidator(storage);
 if(invalidate){
  const siblings=entry.translationGroup?await new ContentRepository(storage.db as any).findTranslationIds(collection,entry.translationGroup):[];
  const tags=[collection,...new Set([entry.id,...siblings]),taxonomyTag(taxonomy)];
  for(const batch of chunks(tags,100))await invalidate(batch);
 }
 const locale=entry.locale||getI18nConfig()?.defaultLocale||'en';
 return {success:true,data:assignmentResponse(await repo.getTermAssignmentsForEntry(collection,entry.id,taxonomy,locale,getI18nConfig()?.defaultLocale??'en'),locale)};
}
