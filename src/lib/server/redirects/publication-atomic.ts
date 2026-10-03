// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Native one-batch composition of the unchanged Source publication UPDATE.
import {sql} from 'kysely';
import {ulid} from 'ulidx';
import {CmsError,type CmsDatabase} from '../database/contract.ts';
import type {PublicationStatementExecutor} from '../database/lifecycle/upstream/host.ts';
import {prepareContentSlugRedirect,executeContentSlugBatch} from './content-atomic.ts';

interface PublicationCollection {id:string;slug:string;version:number;urlPattern:string|null}
/** Captures the native service's already-validated collection, not new claims. */
export function publicationStatementExecutor(database:CmsDatabase,collection:PublicationCollection,
 redirectCompletionCandidate:(plannedOrConfirmed:boolean)=>void):PublicationStatementExecutor {
 return async(statement,existing,intendedSlug,intendedPublishedAt)=>{
  const plan=existing.status==='published'?await prepareContentSlugRedirect(database,{
   collection:collection.slug,id:existing.id,oldSlug:existing.slug,newSlug:intendedSlug,
   urlPattern:collection.urlPattern,oldPublishedAt:existing.publishedAt??null,newPublishedAt:intendedPublishedAt
  }):null;
  // Existing first-publish, equal-slug and zero-table statement behavior stays.
  if(!plan)return statement.execute(database.db);
  const token=ulid();
  const prefix=[
   sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN EXISTS(SELECT 1 FROM _cms_collections
    WHERE id=${collection.id} AND version=${collection.version}) THEN 1 ELSE 0 END`.compile(database.db),
   statement.compile(database.db)
  ];
  const suffix=[sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db)];
  let results;
  // Keep the final actually attempted plan while the repository retains its
  // Source reconciliation. Its successful publication reconciliation confirms
  // the content UPDATE committed; the physical one-batch contract also commits
  // that plan's guaranteed redirect write. Rollback/unconfirmed failures never
  // reach the service's AFTER-success completion boundary.
  try{results=await executeContentSlugBatch(database,prefix,plan,suffix,
   actualPlan=>redirectCompletionCandidate(actualPlan.redirectWritePlanned));}
  catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
  const result=results[1];if(!result)throw new Error('Missing native publication statement result');
  // Normally returned results remain the direct evidence of actual row writes.
  redirectCompletionCandidate(plan.redirectResultIndices.some(index=>results[2+index]?.rows.length));
  return result;
 };
}
