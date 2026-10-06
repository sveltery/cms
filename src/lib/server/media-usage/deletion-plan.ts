// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Native C-07 fixed-plan adaptation of whole pinned Source deletion phases.
// Compilation only: this module has no query or batch executor.
import { expressionBuilder,sql,type CompiledQuery,type Kysely,type Updateable } from 'kysely';
import { seedDomainPlanCompiler } from '../seed/namespace.ts';
import type { Database,MediaUsageCollectionDeletionTable } from './upstream/database/types.ts';
import { collectionDeletionCurrentTimestamp,type MediaUsageCollectionDeletionRecord } from './upstream/media/usage/collection-deletion.ts';
import { validateIdentifier } from './upstream/database/validate.ts';
import { FTSManager } from '../content-picker/fts-manager.ts';

type Claim=MediaUsageCollectionDeletionRecord & {leaseToken:string};
export interface DeletionPlanReceipt {
  index:number;
  role:'read-fence'|'delete'|'checkpoint'|'checkpoint-guard'|'guard-cleanup'|'diagnostic'|'ddl';
  queryId:string;
  interpretation:string;
}
export interface CompiledDeletionPhase {
  phase:Claim['phase'];
  statements:readonly CompiledQuery[];
  receipts:readonly DeletionPlanReceipt[];
}
type Planner=Kysely<Database>;
function compiler(view:Kysely<Database>):Planner {
  return seedDomainPlanCompiler(view) as Planner;
}
// Source processor guards intentionally have no phase/slug predicate.
function liveLease(db:Planner,claim:Claim) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM _cms_media_usage_collection_deletions AS deletion
    WHERE deletion.collection_id = ${claim.collectionId}
      AND deletion.state = 'leased'
      AND deletion.lease_token = ${claim.leaseToken}
      AND deletion.lease_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )`;
}
function liveFrontLease(db:Planner,claim:Claim,phase:'fence'|'registry'|'table') {
  return db.selectFrom('_cms_media_usage_collection_deletions as deletion')
    .select('deletion.collection_id').where('deletion.collection_id','=',claim.collectionId)
    .where('deletion.collection_slug','=',claim.collectionSlug).where('deletion.state','=','leased')
    .where('deletion.phase','=',phase).where('deletion.lease_token','=',claim.leaseToken)
    .where(sql<boolean>`deletion.lease_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
}
function checkpoint(db:Planner,claim:Claim,values:Updateable<MediaUsageCollectionDeletionTable>) {
  return db.updateTable('_cms_media_usage_collection_deletions').set({
    ...values,attempt_count:0,last_error_code:null,updated_at:collectionDeletionCurrentTimestamp(db),
  }).where('collection_id','=',claim.collectionId).where('state','=','leased')
    .where('lease_token','=',claim.leaseToken).where(liveLease(db,claim)).returning('collection_id');
}
function fixedPlan(phase:Claim['phase']) {
  const statements:CompiledQuery[]=[];const receipts:DeletionPlanReceipt[]=[];
  return {
    append(statement:CompiledQuery,role:DeletionPlanReceipt['role'],interpretation:string) {
      if(statement.parameters.length>100)throw new Error('Deletion statement exceeds 100 D1 bindings');
      receipts.push({index:statements.length,role,queryId:statement.queryId.queryId,interpretation});
      statements.push(statement);
    },
    finish():CompiledDeletionPhase{return {phase,statements,receipts};},
  };
}
function token(claim:Claim,index:number){return `media-usage-deletion:${claim.collectionId}:${claim.leaseToken}:${index}`;}
function guard(db:Planner,key:string,condition:ReturnType<typeof sql<boolean>>) {
  // Existing canonical foundation CHECK(pass=1) supplies real in-batch rollback.
  return (db as Kysely<any>).insertInto('_cms_guards').values({token:key,
    pass:sql<number>`CASE WHEN ${condition} THEN 1 ELSE 0 END`}).compile();
}
function cleanupGuard(db:Planner,key:string) {
  return (db as Kysely<any>).deleteFrom('_cms_guards').where('token','=',key).compile();
}
function appendCheckpoint(plan:ReturnType<typeof fixedPlan>,db:Planner,claim:Claim,
  values:Updateable<MediaUsageCollectionDeletionTable>,index:number) {
  plan.append(checkpoint(db,claim,values).compile(),'checkpoint','Actual UPDATE RETURNING collection_id must contain exactly one row');
  const key=token(claim,index);
  plan.append(guard(db,key,sql<boolean>`changes() = ${1}`),'checkpoint-guard',
    'Immediately previous checkpoint affected exactly one physical row; CHECK failure rolls back the whole batch');
  plan.append(cleanupGuard(db,key),'guard-cleanup','Remove only this checkpoint guard token within the same batch');
}
function workPage(db:Pick<Planner,'selectFrom'>,claim:Claim) {
  return db.selectFrom('_cms_media_usage_work').select('content_id').where('collection_id','=',claim.collectionId)
    .$if(claim.workCursor!==null,q=>q.where('content_id','>',claim.workCursor!))
    .orderBy('content_id','asc').limit(51);
}
export function compileDeletionWorkRead(view:Kysely<Database>,claim:Claim) {
  return workPage(compiler(view),claim).compile();
}
export function compileDeletionWorkPhase(view:Kysely<Database>,claim:Claim,rows:readonly {content_id:string}[]) {
  if(rows.length>51)throw new Error('Deletion work page exceeds Source limit 51');
  const db=compiler(view),plan=fixedPlan('work'),batch=rows.slice(0,50),key=token(claim,0);
  plan.append(guard(db,key,sql<boolean>`COALESCE((SELECT json_group_array(content_id) FROM (${workPage(expressionBuilder<Database>(),claim)}) AS page),'[]') = ${JSON.stringify(rows.map(r=>r.content_id))}`),
    'read-fence','Actual sorted Source work page still equals the separately read page before deletion');
  if(batch.length)plan.append(db.deleteFrom('_cms_media_usage_work').where('collection_id','=',claim.collectionId)
    .where('content_id','in',batch.map(r=>r.content_id)).where(liveLease(db,claim)).compile(),
    'delete','Delete at most 50 actual selected IDs under the unchanged Source live lease predicate');
  appendCheckpoint(plan,db,claim,{phase:rows.length>50?'work':'sources',work_cursor:rows.length>50?batch.at(-1)!.content_id:null},1);
  plan.append(cleanupGuard(db,key),'guard-cleanup','Remove the work read fence within the same batch');
  return plan.finish();
}
function firstSource(db:Pick<Planner,'selectFrom'>,claim:Claim) {
  return db.selectFrom('_cms_media_usage_sources').select('source_key').where('source_type','=','content')
    .where('collection_id','=',claim.collectionId).orderBy('source_key','asc').limit(1);
}
function occurrencePage(db:Pick<Planner,'selectFrom'>,claim:Claim,sourceKey:string) {
  return db.selectFrom('_cms_media_usage').select('id').where('source_key','=',sourceKey)
    .$if(claim.occurrenceCursor!==null,q=>q.where('id','>',claim.occurrenceCursor!)).orderBy('id','asc').limit(51);
}
export function compileDeletionSourceReads(view:Kysely<Database>,claim:Claim,sourceKey?:string) {
  const db=compiler(view);
  return {firstSource:!claim.sourceKey&&sourceKey===undefined?firstSource(db,claim).compile():undefined,
    occurrences:sourceKey?occurrencePage(db,claim,sourceKey).compile():undefined};
}
export function compileDeletionSourcePhase(view:Kysely<Database>,claim:Claim,
  sourceKey:string|null,rows:readonly {id:string}[]) {
  if(rows.length>51)throw new Error('Deletion occurrence page exceeds Source limit 51');
  const db=compiler(view),plan=fixedPlan('sources');let checkpointIndex=1;
  const keys:string[]=[];
  if(!claim.sourceKey){
    const key=token(claim,0);keys.push(key);
    plan.append(guard(db,key,sql<boolean>`(SELECT source_key FROM (${firstSource(expressionBuilder<Database>(),claim)}) AS source) IS ${sourceKey}`),
      'read-fence','Actual first content source key or absence matches the separately read Source result');
    if(!sourceKey){
      appendCheckpoint(plan,db,claim,{phase:'status',source_key:null,occurrence_cursor:null},checkpointIndex);
      plan.append(cleanupGuard(db,key),'guard-cleanup','Remove first-source read fence');return plan.finish();
    }
    appendCheckpoint(plan,db,claim,{source_key:sourceKey,occurrence_cursor:null},checkpointIndex++);
  }
  if(!sourceKey)throw new Error('Source deletion phase requires its actual selected source key');
  const pageKey=token(claim,3);keys.push(pageKey);
  plan.append(guard(db,pageKey,sql<boolean>`COALESCE((SELECT json_group_array(id) FROM (${occurrencePage(expressionBuilder<Database>(),claim,sourceKey)}) AS page),'[]') = ${JSON.stringify(rows.map(r=>r.id))}`),
    'read-fence','Actual sorted Source occurrence page still equals its separately read page');
  const batch=rows.slice(0,50);
  if(batch.length)plan.append(db.deleteFrom('_cms_media_usage').where('source_key','=',sourceKey)
    .where('id','in',batch.map(r=>r.id)).where(liveLease(db,claim)).compile(),'delete','At most 50 actual selected occurrences under unchanged Source lease guard');
  if(rows.length>50)appendCheckpoint(plan,db,claim,{source_key:sourceKey,occurrence_cursor:batch.at(-1)!.id},checkpointIndex);
  else{
    plan.append(db.deleteFrom('_cms_media_usage_sources').where('source_key','=',sourceKey)
      .where('source_type','=','content').where('collection_id','=',claim.collectionId)
      .where(liveLease(db,claim)).compile(),'delete','Delete the exact exhausted content source identity');
    appendCheckpoint(plan,db,claim,{source_key:null,occurrence_cursor:null},checkpointIndex);
  }
  for(const key of keys)plan.append(cleanupGuard(db,key),'guard-cleanup','Remove only this read fence');
  return plan.finish();
}
function noCleanupWorkOrSources(claim:Claim) {
  return sql<boolean>`NOT EXISTS (SELECT 1 FROM _cms_media_usage_work WHERE collection_id = ${claim.collectionId})
    AND NOT EXISTS (SELECT 1 FROM _cms_media_usage_sources WHERE source_type = 'content' AND collection_id = ${claim.collectionId})`;
}
export function compileDeletionStatusPhase(view:Kysely<Database>,claim:Claim) {
  const db=compiler(view),plan=fixedPlan('status'),key=token(claim,0);
  plan.append(guard(db,key,noCleanupWorkOrSources(claim)),'read-fence','Source refuses cleanup while actual content work or sources remain');
  plan.append(db.deleteFrom('_cms_media_usage_reconciliations').where('collection_id','=',claim.collectionId)
    .where('collection_slug','=',claim.collectionSlug).where(liveLease(db,claim)).compile(),
    'delete','Delete exact reconciliation metadata under Source live lease guard');
  plan.append(db.deleteFrom('_cms_media_usage_index_status').where('adapter_id','=','content-media')
    .where('scope_type','=','collection').where('scope_key','=',claim.collectionSlug)
    .where('collection_id','=',claim.collectionId).where(liveLease(db,claim)).compile(),
    'delete','Delete exact adapter/scope/slug/collection status under Source live lease guard');
  appendCheckpoint(plan,db,claim,{phase:'finalize'},1);
  plan.append(cleanupGuard(db,key),'guard-cleanup','Remove cleanup precondition guard');return plan.finish();
}
export function compileDeletionRegistryPhase(view:Kysely<Database>,claim:Claim) {
  const db=compiler(view),plan=fixedPlan('registry');
  plan.append(db.deleteFrom('_cms_collections').where('id','=',claim.collectionId).where('slug','=',claim.collectionSlug)
    .where(eb=>eb.exists(liveFrontLease(db,claim,'registry'))).compile(),
    'delete','Source permits zero registry rows deleted');
  plan.append(db.updateTable('_cms_media_usage_collection_deletions').set({phase:'table',updated_at:collectionDeletionCurrentTimestamp(db)})
    .where('collection_id','=',claim.collectionId).where('collection_slug','=',claim.collectionSlug)
    .where('state','=','leased').where('phase','=','registry').where('lease_token','=',claim.leaseToken)
    .where(sql<boolean>`lease_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).returning('collection_id').compile(),
    'checkpoint','Source returns false when this checkpoint affects zero rows; deliberately no missed-checkpoint rollback guard');
  return plan.finish();
}
export function compileDeletionFinalizePhase(view:Kysely<Database>,claim:Claim) {
  const db=compiler(view),plan=fixedPlan('finalize'),key=token(claim,0);
  validateIdentifier(claim.collectionSlug,'collection slug');
  plan.append(guard(db,key,sql<boolean>`${noCleanupWorkOrSources(claim)}
    AND NOT EXISTS (SELECT 1 FROM _cms_media_usage_index_status WHERE adapter_id = 'content-media' AND scope_type = 'collection' AND scope_key = ${claim.collectionSlug} AND collection_id = ${claim.collectionId})
    AND NOT EXISTS (SELECT 1 FROM _cms_collections WHERE id = ${claim.collectionId} AND slug = ${claim.collectionSlug})
    AND NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ${`ec_${claim.collectionSlug}`})`),
    'read-fence','Actual Source finalization table, cleanup and exact registry absence preconditions hold together');
  plan.append(db.deleteFrom('_cms_media_usage_collection_deletions').where('collection_id','=',claim.collectionId)
    .where('collection_slug','=',claim.collectionSlug).where('state','=','leased').where('phase','=','finalize')
    .where('lease_token','=',claim.leaseToken).where(liveLease(db,claim)).returning('collection_id').compile(),
    'delete','Actual finalize DELETE RETURNING must contain exactly one row');
  const receiptKey=token(claim,1);
  plan.append(guard(db,receiptKey,sql<boolean>`changes() = ${1}`),'checkpoint-guard','Real missing finalization receipt aborts the entire batch');
  plan.append(cleanupGuard(db,receiptKey),'guard-cleanup','Remove finalization receipt guard');
  plan.append(cleanupGuard(db,key),'guard-cleanup','Remove finalization precondition guard');return plan.finish();
}
export function compileDeletionTablePhase(view:Kysely<Database>,claim:Claim) {
  const db=compiler(view),plan=fixedPlan('table'),key=token(claim,0);
  validateIdentifier(claim.collectionSlug,'collection slug');
  plan.append(guard(db,key,sql<boolean>`EXISTS (${liveFrontLease(db,claim,'table')})`),
    'read-fence','Exact Source leased table-phase tombstone must still be live before any DDL');
  const ftsTable=new FTSManager(db as never).getFtsTableName(claim.collectionSlug);
  for(const suffix of ['insert','update','delete'])plan.append(sql`DROP TRIGGER IF EXISTS ${sql.ref(`${ftsTable}_${suffix}`)}`.compile(db),
    'ddl','Existing Source FTS trigger name, validated by the actual canonical FTS producer');
  plan.append(db.schema.dropTable(ftsTable).ifExists().compile(),'ddl','Actual canonical FTS table drop');
  plan.append(db.schema.dropTable(`ec_${claim.collectionSlug}`).ifExists().compile(),'ddl','Actual collection content table drop');
  plan.append(cleanupGuard(db,key),'guard-cleanup','Remove exact table-phase guard');return plan.finish();
}
export function compileDeletionFencePhase(view:Kysely<Database>,claim:Claim) {
  const db=compiler(view),plan=fixedPlan('fence');validateIdentifier(claim.collectionSlug,'collection slug');
  plan.append(db.updateTable('_cms_media_usage_index_status as status').set({capture_state:'deleting',updated_at:collectionDeletionCurrentTimestamp(db)})
    .where('status.adapter_id','=','content-media').where('status.scope_type','=','collection')
    .where('status.scope_key','=',claim.collectionSlug).where('status.collection_id','=',claim.collectionId)
    .where('status.capture_state','=','active')
    .where(eb=>eb.exists(db.selectFrom('_cms_collections').select('id').where('id','=',claim.collectionId).where('slug','=',claim.collectionSlug)))
    .where(eb=>eb.exists(liveFrontLease(db,claim,'fence')))
    .$if(!claim.forceDelete,q=>q.where(sql<boolean>`NOT EXISTS (SELECT 1 FROM ${sql.ref(`ec_${claim.collectionSlug}`)} WHERE deleted_at IS NULL LIMIT 1)`))
    .returning('collection_id').compile(),'checkpoint','Real Source D1 fence receipt: nonempty returned rows means fenced; zero requires exact Source diagnostic');
  if(!claim.forceDelete)plan.append(sql`SELECT CASE WHEN EXISTS (${liveFrontLease(db,claim,'fence')})
    AND EXISTS (SELECT 1 FROM _cms_media_usage_index_status WHERE adapter_id = 'content-media' AND scope_type = 'collection' AND scope_key = ${claim.collectionSlug} AND collection_id = ${claim.collectionId} AND capture_state = 'active')
    AND EXISTS (SELECT 1 FROM ${sql.ref(`ec_${claim.collectionSlug}`)} WHERE deleted_at IS NULL LIMIT 1)
    THEN 'has_content' ELSE 'stale' END AS outcome`.compile(db),
    'diagnostic','Exact Source D1 diagnostic has no invented registry predicate');
  return plan.finish();
}
