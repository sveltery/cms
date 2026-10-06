// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Native C-07 fixed work/sources/status phases, qualified against complete Source.
import { sql,type Kysely,type QueryResult } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { seedSourceDatabase,seedDatabaseOwner,seedDomainPlanCompiler } from '../seed/namespace.ts';
import type { Database } from './upstream/database/types.ts';
import type { MediaUsageCollectionDeletionRecord } from './upstream/media/usage/collection-deletion.ts';
import { compileDeletionWorkRead,compileDeletionWorkPhase,compileDeletionSourceReads,
  compileDeletionSourcePhase,compileDeletionStatusPhase,type CompiledDeletionPhase } from './deletion-plan.ts';

type Claim=MediaUsageCollectionDeletionRecord & {leaseToken:string};
/** Named finite domain for the sole trusted owner. The registered query view
 * stays private; callers receive no SQL executor, builder or factory callback. */
export class NativeMediaUsageCollectionDeletionPhases {
  readonly #database:CmsDatabase;
  readonly #view:Kysely<Database>;
  constructor(database:CmsDatabase,registeredView?:Kysely<Database>) {
    const view=registeredView??seedSourceDatabase(database) as unknown as Kysely<Database>;
    if(seedDatabaseOwner(view)!==database)throw new Error('Deletion phases require their exact registered CMS owner');
    this.#database=database;this.#view=view;
  }
  async processWork(claim:Claim):Promise<boolean> {
    const rows=(await this.#view.executeQuery<{content_id:string}>(compileDeletionWorkRead(this.#view,claim))).rows;
    await this.#execute(compileDeletionWorkPhase(this.#view,claim,rows));return false;
  }
  async processSources(claim:Claim):Promise<boolean> {
    let sourceKey=claim.sourceKey;
    if(!sourceKey){
      const query=compileDeletionSourceReads(this.#view,claim).firstSource!;
      sourceKey=(await this.#view.executeQuery<{source_key:string}>(query)).rows[0]?.source_key??null;
    }
    const rows=sourceKey?(await this.#view.executeQuery<{id:string}>(
      compileDeletionSourceReads(this.#view,claim,sourceKey).occurrences!)).rows:[];
    await this.#execute(compileDeletionSourcePhase(this.#view,claim,sourceKey,rows));return false;
  }
  async processStatus(claim:Claim):Promise<boolean> {
    // Preserve the genuine Source cleanup refusal and message before writes;
    // the same precondition is also fenced inside the actual atomic batch.
    const result=await sql<{work_present:number;source_present:number;status_present:number}>`
      SELECT EXISTS (SELECT 1 FROM _cms_media_usage_work WHERE collection_id=${claim.collectionId}) AS work_present,
      EXISTS (SELECT 1 FROM _cms_media_usage_sources WHERE source_type='content' AND collection_id=${claim.collectionId}) AS source_present,
      EXISTS (SELECT 1 FROM _cms_media_usage_index_status WHERE adapter_id='content-media' AND scope_type='collection'
        AND scope_key=${claim.collectionSlug} AND collection_id=${claim.collectionId}) AS status_present
    `.execute(this.#view);
    if(result.rows[0]?.work_present||result.rows[0]?.source_present)throw new Error('Collection deletion cleanup is incomplete');
    await this.#execute(compileDeletionStatusPhase(this.#view,claim));return false;
  }
  async #execute(plan:CompiledDeletionPhase):Promise<void> {
    if(!['work','sources','status'].includes(plan.phase))throw new Error('This finite domain owns only qualified cleanup phases');
    const receipts=await this.#database.atomicBatch(plan.statements);
    // This is the exact same observer protocol as the public Seed typed plan:
    // actual receipt and query ID, once, in statement order after fixed commit.
    const plugins=seedDomainPlanCompiler(this.#view).getExecutor().plugins;
    const transformed:QueryResult<unknown>[]=[];
    for(let index=0;index<receipts.length;index++){
      let result=receipts[index];
      for(const plugin of plugins)result=await plugin.transformResult({result:result as QueryResult<import('kysely').UnknownRow>,queryId:plan.statements[index].queryId});
      transformed.push(result);
    }
    for(const receipt of plan.receipts)if(receipt.role==='checkpoint'&&transformed[receipt.index]?.rows.length!==1){
      throw new Error('Collection deletion lease was lost');
    }
  }
}
