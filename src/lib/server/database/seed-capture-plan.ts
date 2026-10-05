// Native raw-D1 specialization of the pinned Source collection-capture phases.
// Reads genuine prerequisite rows, then supplies one fixed plan to the sole
// Native schema writer. Source Node bodies remain exact; no callback is run.
import { sql, CompiledQuery, type Kysely } from 'kysely';
import type { CmsDatabase } from './contract.ts';
import { seedSourceDatabase, seedDomainPlanCompiler } from '../seed/namespace.ts';
import { captureIdentifiers, sqliteTriggerSql, operationSql, captureOperations, normalizeDdl } from '../seed/d1-capture-builder.ts';
import type { prepareMediaUsageCollectionCapture } from '../seed/upstream/media/usage/activation.ts';
import type { Database as CaptureDatabase } from '../blocks/upstream/database/types.ts';

export async function buildSeedCapturedCreationPlan(database: CmsDatabase,
  input: Parameters<typeof prepareMediaUsageCollectionCapture>[1],
  statements: readonly CompiledQuery[], collectionOffset: number, tableOffset: number
): Promise<CompiledQuery[]> {
  const logical = seedSourceDatabase(database), compiler = seedDomainPlanCompiler(logical), db = database.db as unknown as Kysely<CaptureDatabase>;
  const existing = await logical.selectFrom('_emdash_media_usage_index_status')
    .select(['collection_id','capture_state','cursor']).where('adapter_id','=','content-media')
    .where('scope_type','=','collection').where('scope_key','=',input.collectionSlug).executeTakeFirst();
  const resuming = existing !== undefined;
  if (existing && (!existing.collection_id || !['installing','ready'].includes(existing.capture_state ?? '') ||
    existing.cursor !== (input.creationFingerprint ?? null) || existing.collection_id !== input.collectionId ||
    input.registeredCollectionId !== undefined && input.registeredCollectionId !== existing.collection_id)) {
    throw new Error('Media usage collection lifecycle identity conflict');
  }
  if (!existing && input.registeredCollectionId !== undefined) throw new Error('Media usage collection lifecycle is missing');
  const identity = {collectionId: input.collectionId, collectionSlug: input.collectionSlug};
  const identifiers = await captureIdentifiers(identity);
  const actual = (await sql<{name:string;definition:string}>`SELECT name,sql AS definition FROM sqlite_master
    WHERE type='trigger' AND tbl_name=${identifiers.tableName} AND substr(name,1,10)='emdash_mu_' LIMIT 101`.execute(logical)).rows;
  if (actual.length > 100) throw new Error('Media usage capture trigger set exceeds the activation limit');
  const active = sql<boolean>`EXISTS(SELECT 1 FROM _cms_media_usage_activation WHERE task_key='incremental_capture' AND state='active' AND runtime_generation=1)`;
  const previous = existing ? sql`EXISTS(SELECT 1 FROM _cms_media_usage_index_status WHERE adapter_id='content-media'
    AND scope_type='collection' AND scope_key=${input.collectionSlug} AND collection_id=${input.collectionId}
    AND capture_state=${existing.capture_state} AND cursor IS ${existing.cursor})` :
    sql`NOT EXISTS(SELECT 1 FROM _cms_media_usage_index_status WHERE adapter_id='content-media' AND scope_type='collection' AND scope_key=${input.collectionSlug})`;
  const fence = (predicate: ReturnType<typeof sql>) => sql`SELECT json_extract('[]',CASE WHEN ${predicate} THEN '$' ELSE 'sveltery-cms-capture-prerequisite-changed' END)`.compile(db);
  const retained = (query:CompiledQuery) => resuming ? CompiledQuery.raw(query.sql
    .replace(/^CREATE (UNIQUE )?INDEX /i,'CREATE $1INDEX IF NOT EXISTS ')
    .replace(/^CREATE TABLE /i,'CREATE TABLE IF NOT EXISTS '),[...query.parameters]) : query;
  const result: CompiledQuery[] = [fence(sql`${active} AND ${previous}`),...statements.slice(0,collectionOffset)];
  if (!existing) result.push(db.insertInto('_cms_media_usage_index_status').values({
    adapter_id:'content-media',scope_type:'collection',scope_key:input.collectionSlug,status:'never',
    collection_id:input.collectionId,reconciliation_required:1,capture_state:'installing',
    cursor:input.creationFingerprint??null,updated_at:sql`strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  }).compile());
  result.push(retained(statements[tableOffset]));
  const expectedNames = new Set(Object.values(identifiers.triggerNames));
  for (const trigger of actual) if (!expectedNames.has(trigger.name)) result.push(sql`DROP TRIGGER IF EXISTS ${sql.ref(trigger.name)}`.compile(db));
  const definitions: {name:string;sql:string}[] = [];
  for (const operation of captureOperations) {
    const name = identifiers.triggerNames[operation];
    const statement = sqliteTriggerSql(identifiers.tableName,name,operationSql(operation),operation==='delete'?sql`OLD.id`:sql`NEW.id`,identity).compile(compiler);
    const installed = actual.find(trigger=>trigger.name===name);
    if (installed && normalizeDdl(installed.definition)!==normalizeDdl(statement.sql)) {
      throw new Error('Media usage capture trigger installation is incomplete');
    }
    definitions.push({name,sql:installed?.definition ?? statement.sql.trim()});
    if (!actual.some(trigger=>trigger.name===name)) result.push(statement);
  }
  // Existing triggers first pass the exact Source normalizer above. Fence their
  // literal stored bytes, or the exact newly installed generated DDL, in-batch.
  result.push(fence(sql`(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND tbl_name=${identifiers.tableName} AND substr(name,1,10)='emdash_mu_')=3
    AND ${sql.join(definitions.map(definition=>sql`EXISTS(SELECT 1 FROM sqlite_master WHERE type='trigger' AND tbl_name=${identifiers.tableName} AND name=${definition.name} AND sql=${definition.sql})`),sql` AND `)}`));
  result.push(db.updateTable('_cms_media_usage_index_status').set({capture_state:'ready',updated_at:sql`strftime('%Y-%m-%dT%H:%M:%fZ','now')`})
    .where('adapter_id','=','content-media').where('scope_type','=','collection').where('scope_key','=',input.collectionSlug)
    .where('collection_id','=',input.collectionId).where('capture_state','in',['installing','ready']).where(active).compile(),fence(sql`changes()=1`));
  if (input.registeredCollectionId===undefined) result.push(statements[collectionOffset]);
  result.push(...statements.slice(tableOffset+1).map(retained));
  result.push(db.updateTable('_cms_media_usage_index_status').set({capture_state:'active',cursor:null,updated_at:sql`strftime('%Y-%m-%dT%H:%M:%fZ','now')`})
    .where('adapter_id','=','content-media').where('scope_type','=','collection').where('scope_key','=',input.collectionSlug)
    .where('collection_id','=',input.collectionId).where('capture_state','=','ready').where(active)
    .where(sql<boolean>`EXISTS(SELECT 1 FROM _cms_collections WHERE id=${input.collectionId} AND slug=${input.collectionSlug})`).compile(),fence(sql`changes()=1`));
  // No BEGIN/COMMIT or arbitrary callback; the caller's actual atomic owner is final.
  if (result.some(statement=>statement.parameters.length>100)) throw new Error('Seed capture statement exceeds the 100-binding D1 limit');
  return result;
}
