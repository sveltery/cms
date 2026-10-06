import { writeFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { seedSourceDatabase } from '../../src/lib/server/seed/namespace.ts';
import type { Database } from '../../src/lib/server/media-usage/upstream/database/types.ts';
import type { Kysely } from 'kysely';
import type { MediaUsageCollectionDeletionRecord } from '../../src/lib/server/media-usage/upstream/media/usage/collection-deletion.ts';
import { compileDeletionFencePhase,compileDeletionRegistryPhase,compileDeletionTablePhase,
  compileDeletionWorkRead,compileDeletionWorkPhase,compileDeletionSourceReads,compileDeletionSourcePhase,
  compileDeletionStatusPhase,compileDeletionFinalizePhase } from '../../src/lib/server/media-usage/deletion-plan.ts';

// Compile-only review artifact. No schema, query, atomic plan or callback is
// executed, and this harness confers no product behavioral or parity credit.
it('compiles the complete finite deletion phase vectors for Root review without executing a plan',async()=>{
  const owner=openSqlite(':memory:');
  try{
    const queries:string[]=[];
    const view=seedSourceDatabase(owner).withPlugin({transformQuery({node,queryId}){
      queries.push(queryId.queryId);return node;
    },async transformResult({result}){throw new Error('Compile-only review must not receive an executed query result');}}) as Kysely<Database>;
    const claim:MediaUsageCollectionDeletionRecord & {leaseToken:string}={
      collectionId:'review-collection',collectionSlug:'review_posts',forceDelete:false,
      state:'leased',phase:'work',workCursor:null,sourceKey:null,occurrenceCursor:null,
      attemptCount:0,nextAttemptAt:'2000-01-01T00:00:00.000Z',leaseToken:'review-controlled-lease',
      leaseExpiresAt:'2100-01-01T00:00:00.000Z',lastErrorCode:null,
      createdAt:'2000-01-01T00:00:00.000Z',updatedAt:'2000-01-01T00:00:00.000Z',
    };
    const entries=Array.from({length:51},(_,i)=>({content_id:`entry-${String(i).padStart(2,'0')}`}));
    const occurrences=Array.from({length:51},(_,i)=>({id:`occurrence-${String(i).padStart(2,'0')}`}));
    const variants=[
      {name:'fence',plan:compileDeletionFencePhase(view,{...claim,phase:'fence'})},
      {name:'fence-force',plan:compileDeletionFencePhase(view,{...claim,phase:'fence',forceDelete:true})},
      {name:'registry',plan:compileDeletionRegistryPhase(view,{...claim,phase:'registry'})},
      {name:'table',plan:compileDeletionTablePhase(view,{...claim,phase:'table'})},
      {name:'work-empty',plan:compileDeletionWorkPhase(view,claim,[])},
      {name:'work-one',plan:compileDeletionWorkPhase(view,claim,entries.slice(0,1))},
      {name:'work-page',plan:compileDeletionWorkPhase(view,claim,entries)},
      {name:'sources-empty',plan:compileDeletionSourcePhase(view,{...claim,phase:'sources'},null,[])},
      {name:'sources-one',plan:compileDeletionSourcePhase(view,{...claim,phase:'sources'},'review-source',occurrences.slice(0,1))},
      {name:'sources-page',plan:compileDeletionSourcePhase(view,{...claim,phase:'sources'},'review-source',occurrences)},
      {name:'sources-existing-cursor',plan:compileDeletionSourcePhase(view,{...claim,phase:'sources',sourceKey:'review-source',occurrenceCursor:'occurrence-00'},'review-source',occurrences.slice(1))},
      {name:'status',plan:compileDeletionStatusPhase(view,{...claim,phase:'status'})},
      {name:'finalize',plan:compileDeletionFinalizePhase(view,{...claim,phase:'finalize'})},
    ];
    const reads={work:compileDeletionWorkRead(view,claim),sources:compileDeletionSourceReads(view,{...claim,phase:'sources'},'review-source')};
    for(const {plan} of variants)for(const statement of plan.statements){
      expect(statement.parameters.length).toBeLessThanOrEqual(100);
      expect(plan.receipts.some(receipt=>receipt.queryId===statement.queryId.queryId)).toBe(true);
    }
    writeFileSync('parity/emdash/media-usage-maintenance-source/deletion-compiled-plan-review-v2.json',JSON.stringify({
      pin:'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e',state:'compiled-only; Root execution qualification pending',
      registeredOwner:true,compiler:'actual public Seed seedDomainPlanCompiler',plansExecuted:0,
      pageVectors:'controlled compile-only fixtures; not observed database pages',
      supersedes:'deletion-compiled-plan-review.json: existing-cursor snapshot incorrectly included its lower bound; original packet retained unchanged',
      originalCallbackIdentityCredit:0,nativeBehavioralCredit:0,
      observerQueryIds:queries,reads,variants,
    },(_key,value)=>typeof value==='bigint'?value.toString():value,2)+'\n');
  }finally{await owner.close();}
});
