// Native D1 storage specialization. Source Node methods stay in their immutable
// repository; fixed SQL and write leases remain owned by that same repository.
import {sql,type Kysely,type RawBuilder,type CompiledQuery} from 'kysely';
import {ulid} from 'ulidx';
import type {CmsDatabase} from '../database/contract.ts';
import {RawBindingD1Adapter} from '../database/d1.ts';
import {registeredSeedDatabaseOwner} from './namespace.ts';
import {registeredBylineDatabaseOwner} from '../bylines/storage.ts';
import {blockDatabaseHost} from '../blocks/upstream/host.ts';
import {MediaUsageRepository as SourceUsage,MEDIA_USAGE_GENERATION_WRITE_LEASE_MS,type MediaUsageSourceInput,type MediaUsageOccurrenceInput,type MediaUsageSource,type MediaUsageGuardedReplaceResult,type MediaUsageGuardedDeleteResult,type MediaUsageGuardedAbsentDeleteResult} from '../blocks/upstream/database/repositories/media-usage.ts';
import {validateIdentifier} from '../blocks/upstream/database/validate.ts';
import type {Database} from '../blocks/upstream/database/types.ts';

// Erased access to genuine inherited pure Source helpers, never copied SQL
// authorities or replaced callbacks. Each invoked method remains Source-owned.
interface PureSource {
 buildSourceRow(source:MediaUsageSourceInput,generation:string,now:string):any;
 sourceUpdateSet(row:any):any;
 sourceMatchExpression(expected:MediaUsageSource):any;
 currentCollectionExists(id:string|null,slug:string|null):RawBuilder<boolean>;
 currentCanonicalContentExists(row:any):RawBuilder<boolean>;
 generationWriteLeaseExpression(row:any,token:string):any;
 generationWriteLeaseExpiryIsInFuture(column:string):RawBuilder<boolean>;
 generationWriteLeaseTimestampOffset(seconds:number):RawBuilder<string>;
 contentRowExists(table:string,id:string):Promise<boolean>;
}

export class MediaUsageRepository extends SourceUsage {
 private readonly nativeD1:boolean;
 private readonly owner:CmsDatabase|undefined;
 constructor(db:Kysely<Database>) {
  const nativeD1=db.getExecutor().adapter instanceof RawBindingD1Adapter;
  const owner=registeredSeedDatabaseOwner(db)??blockDatabaseHost(db)??registeredBylineDatabaseOwner(db as unknown as Parameters<typeof registeredBylineDatabaseOwner>[0]);
  if(nativeD1&&!owner)throw new Error('Native D1 media usage requires its actual registered database owner');
  super(nativeD1?owner!.db as unknown as Kysely<Database>:db);
  this.nativeD1=nativeD1;
  this.owner=owner;
 }
 override async replaceSourceIfMatching(source:MediaUsageSourceInput,occurrences:readonly MediaUsageOccurrenceInput[],expectedSource:MediaUsageSource|null):Promise<MediaUsageGuardedReplaceResult> {
  if(!this.nativeD1)return super.replaceSourceIfMatching(source,occurrences,expectedSource);
  if(expectedSource!==null&&await this.projectionMatchesExpectedSource(source,expectedSource))return{replaced:false,unchanged:true,source:null};
  // The public progress DTO intentionally omits capture_state. Read the real
  // canonical capture identity instead of treating that omission as inactive.
  const db=this.owner!.db as unknown as Kysely<Database>;
  const capture=source.collectionSlug&&source.collectionId?await db.selectFrom('_cms_media_usage_index_status').select('capture_state')
   .where('adapter_id','=','content-media').where('scope_type','=','collection').where('scope_key','=',source.collectionSlug).where('collection_id','=',source.collectionId).executeTakeFirst():undefined;
  if(capture?.capture_state!=='active')return this.replacePreActivationSource(source,occurrences,expectedSource);
  const changed=expectedSource===null
   ?await this.replaceNewSourcesBatch([{source,occurrences}])
   :await this.replaceExistingSourcesBatch([{source,occurrences,expectedSource}]);
  const replaced=changed.has(source.sourceKey);
  return{replaced,unchanged:false,source:replaced?null:await this.findSource(source.sourceKey)};
 }
 override async deleteSourceIfMatching(key:string,expected:MediaUsageSource):Promise<MediaUsageGuardedDeleteResult>{
  if(!this.nativeD1)return super.deleteSourceIfMatching(key,expected);
  const deleted=await this.deleteMatchingGeneration(key,expected);
  return{deleted,source:await this.findSource(key)};
 }
 override async deleteSourceIfMatchingContentAbsent(key:string,expected:MediaUsageSource,collection:string,id:string):Promise<MediaUsageGuardedAbsentDeleteResult>{
  if(!this.nativeD1)return super.deleteSourceIfMatchingContentAbsent(key,expected,collection,id);
  validateIdentifier(collection,'collection slug');const table=`ec_${collection}`;
  const deleted=await this.deleteMatchingGeneration(key,expected,sql<boolean>`NOT EXISTS(SELECT 1 FROM ${sql.ref(table)} WHERE id=${id})`);
  const present=deleted?false:await (this as unknown as PureSource).contentRowExists(table,id);
  return{deleted,contentPresent:present,source:deleted||present?null:await this.findSource(key)};
 }
 /** Fixed D1 snapshot permits cleanup before deletion under the same exact
  * Source predicate. The whole body commits together, with a real receipt. */
 private async deleteMatchingGeneration(key:string,expected:MediaUsageSource,absence?:RawBuilder<boolean>):Promise<boolean>{
  const owner=this.owner!,db=owner.db as unknown as Kysely<Database>,pure=this as unknown as PureSource;
  let match=db.selectFrom('_cms_media_usage_sources').select('source_key').where('source_key','=',key)
   .where(pure.sourceMatchExpression(expected)).where(pure.currentCollectionExists(expected.collectionId,expected.collectionSlug));
  let deletion=db.deleteFrom('_cms_media_usage_sources').where('source_key','=',key)
   .where(pure.sourceMatchExpression(expected)).where(pure.currentCollectionExists(expected.collectionId,expected.collectionSlug));
  if(absence){match=match.where(absence);deletion=deletion.where(absence);}
  const statements=[db.updateTable('_cms_media_usage').set({cleanup_lease_token:null}).where('source_key','=',key).where('generation','=',expected.currentGeneration).where(eb=>eb.exists(match)).compile(),
   db.deleteFrom('_cms_media_usage').where('source_key','=',key).where('generation','=',expected.currentGeneration).where(eb=>eb.exists(match)).compile(),deletion.returning('source_key').compile()];
  if(statements.some(statement=>statement.parameters.length>100))throw new Error('Native D1 media usage deletion exceeds 100 bindings');
  const results=await owner.atomicBatch(statements);return results[2].rows.length>0;
 }
 override async deleteContentSources(collection:string,id:string):Promise<number>{
  if(!this.nativeD1)return super.deleteContentSources(collection,id);
  const owner=this.owner!,db=owner.db as unknown as Kysely<Database>;
  const rows=await db.selectFrom('_cms_media_usage_sources').select('source_key').where('source_type','=','content').where('collection_slug','=',collection).where('content_id','=',id).execute();
  const keys=[...new Set(rows.map(row=>row.source_key))],statements:CompiledQuery[]=[];
  for(let start=0;start<keys.length;start+=50){const batch=keys.slice(start,start+50);statements.push(db.deleteFrom('_cms_media_usage_sources').where('source_key','in',batch).returning('source_key').compile(),db.updateTable('_cms_media_usage').set({cleanup_lease_token:null}).where('source_key','in',batch).compile(),db.deleteFrom('_cms_media_usage').where('source_key','in',batch).compile());}
  if(!statements.length)return 0;
  const results=await owner.atomicBatch(statements);return results.reduce((count,result,index)=>count+(index%3===0?result.rows.length:0),0);
 }

 /** Source single-source contract before capture activation. The admitted
  * generation lease remains outside the actual fixed body batch, as in Source.
  * Native body atomicity is the existing C07 platform difference. */
 private async replacePreActivationSource(source:MediaUsageSourceInput,occurrences:readonly MediaUsageOccurrenceInput[],expectedSource:MediaUsageSource|null):Promise<MediaUsageGuardedReplaceResult> {
  const owner=this.owner!,db=owner.db as unknown as Kysely<Database>,pure=this as unknown as PureSource;
  const generation=ulid(),token=ulid();
  const admission=await sql<{created_at:string}>`INSERT INTO _cms_media_usage_generation_writes(source_key,generation,lease_token,expires_at,created_at)
   SELECT ${source.sourceKey},${generation},${token},${pure.generationWriteLeaseTimestampOffset(MEDIA_USAGE_GENERATION_WRITE_LEASE_MS/1000)},${pure.generationWriteLeaseTimestampOffset(0)}
   WHERE ${pure.currentCollectionExists(source.collectionId??null,source.collectionSlug??null)} RETURNING created_at`.execute(db);
  const admitted=admission.rows[0];
  if(!admitted)return{replaced:false,unchanged:false,source:await this.findSource(source.sourceKey)};
  try{
   const row=pure.buildSourceRow(source,generation,admitted.created_at),statements:CompiledQuery[]=[];
   const rows=occurrences.map(occurrence=>({id:ulid(),source_key:source.sourceKey,generation,field_slug:occurrence.fieldSlug,field_path:occurrence.fieldPath,occurrence_index:occurrence.occurrenceIndex??0,reference_type:occurrence.referenceType,media_id:occurrence.mediaId,provider:occurrence.provider,provider_asset_id:occurrence.providerAssetId,media_kind:occurrence.mediaKind??null,mime_type:occurrence.mimeType??null,created_at:admitted.created_at}));
   for(let start=0;start<rows.length;start+=7)statements.push(db.insertInto('_cms_media_usage').values(rows.slice(start,start+7)).compile());
   const receiptIndex=statements.length;
   if(expectedSource===null){
    const entries=Object.entries(row);
    statements.push(sql`INSERT INTO _cms_media_usage_sources(${sql.join(entries.map(([key])=>sql.ref(key)))})
     SELECT ${sql.join(entries.map(([,value])=>sql`${value}`))}
     WHERE EXISTS(SELECT 1 FROM _cms_media_usage_generation_writes WHERE source_key=${row.source_key} AND generation=${row.current_generation} AND lease_token=${token} AND ${pure.generationWriteLeaseExpiryIsInFuture('expires_at')})
     AND ${pure.currentCollectionExists(row.collection_id,row.collection_slug)} AND ${pure.currentCanonicalContentExists(row)}
     ON CONFLICT(source_key) DO NOTHING RETURNING source_key`.compile(db));
   }else{
    statements.push(db.updateTable('_cms_media_usage_sources').set(pure.sourceUpdateSet(row)).where('source_key','=',row.source_key)
     .where(pure.sourceMatchExpression(expectedSource)).where(pure.generationWriteLeaseExpression(row,token))
     .where(pure.currentCollectionExists(row.collection_id,row.collection_slug)).where(pure.currentCanonicalContentExists(row)).returning('source_key').compile());
   }
   if(statements.some(statement=>statement.parameters.length>100))throw new Error('Native D1 media usage statement exceeds 100 bindings');
   const results=await owner.atomicBatch(statements),replaced=results[receiptIndex].rows.length>0;
   return{replaced,unchanged:false,source:replaced?null:await this.findSource(source.sourceKey)};
  }finally{
   try{await db.deleteFrom('_cms_media_usage_generation_writes').where('source_key','=',source.sourceKey).where('generation','=',generation).where('lease_token','=',token).execute();}
   catch(error){console.error('[media-usage] Failed to release generation write lease:',error);}
  }
 }
}
