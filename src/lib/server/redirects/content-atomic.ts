// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Source createSlugChangeRedirect and createAutoRedirect at immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; full authorities retained in parity.
// Owned native compiled statements provide ONE Node/D1 atomic content batch.
import {sql,type CompiledQuery,type QueryResult} from 'kysely';
import {ulid} from 'ulidx';
import type {CmsDatabase} from '../database/contract.ts';
import type {Database} from './database-types.ts';
import {redirectSchemaPresent,RedirectSchemaIncompleteError} from './readiness.ts';
import {CmsError} from '../database/contract.ts';
import {RedirectWriteBusyError} from './repository.ts';
import {interpolateUrlPattern} from './url-pattern.ts';
import {invalidateRedirectCache} from './cache.ts';
import {invalidateDatabaseRedirectCache} from './database-cache.ts';
import {publishRedirectChanges} from './artifacts.ts';
import {after} from './after.ts';
import {validateIdentifier} from '../database/lifecycle/upstream/database/validate.ts';

export interface ContentSlugRedirectInput {
 collection:string;id:string;oldSlug:string|null;newSlug:unknown;
 urlPattern:string|null;oldPublishedAt:string|null;newPublishedAt:string|null;
}
export interface ContentSlugRedirectBatch {
 readonly input:ContentSlugRedirectInput;
 readonly timestampError?:RangeError;
 readonly statements:readonly CompiledQuery[];
 /** Index inside statements, not the caller's surrounding atomic batch. */
 readonly redirectResultIndices:readonly number[];
}
const LEASE_BUSY='sveltery-redirect-lease-occupied';
const SNAPSHOT_CHANGED='sveltery-redirect-snapshot-changed';
const FENCE_CHANGED='sveltery-redirect-generation-changed';
const INVALID_TIMESTAMP='sveltery-redirect-invalid-timestamp';
interface ExistingRedirectSnapshot {id:string;updated_at:string|null;config_revision:string|null;destination:string}

/** Called before mutation; no DDL, lease, content or redirect write occurs here. */
export async function prepareContentSlugRedirect(
 database:CmsDatabase,input:ContentSlugRedirectInput
):Promise<ContentSlugRedirectBatch|null> {
 if(typeof input.newSlug!=='string'||!input.newSlug||!input.oldSlug||input.oldSlug===input.newSlug)return null;
 if(!await redirectSchemaPresent(database.db))return null;
 validateIdentifier(input.collection,'collection slug');
 const oldUrl=interpolateUrlPattern({pattern:input.urlPattern,collection:input.collection,slug:input.oldSlug,id:input.id,date:input.oldPublishedAt});
 const newUrl=interpolateUrlPattern({pattern:input.urlPattern,collection:input.collection,slug:input.newSlug,id:input.id,date:input.newPublishedAt});
 const equalUrls=oldUrl===newUrl;
 const db=database.db,table=sql.ref(`ec_${input.collection}`);
 const token=ulid(),casGuard=ulid(),snapshotGuard=ulid(),leaseGuard=ulid(),finalGuard=ulid(),generationPrefix=ulid()+':';
 const now=new Date().toISOString(),clock=Date.now();
 const survives=sql`EXISTS(SELECT 1 FROM ${table} WHERE slug=${input.oldSlug} AND id!=${input.id} AND deleted_at IS NULL)`;
 const held=await sql<{survives:number}>`SELECT CASE WHEN ${survives} THEN 1 ELSE 0 END AS survives`.execute(db);
 const survivor=held.rows[0]?.survives===1;
 const selected=survivor||equalUrls?undefined:(await sql<ExistingRedirectSnapshot>`SELECT id,updated_at,config_revision,destination
  FROM _cms_redirects WHERE source=${oldUrl} LIMIT 1`.execute(db)).rows[0];
 // Source updates the selected old-source row AFTER chain collapse. Collapse
 // replaces even a future/invalid timestamp when this row points to oldUrl.
 // JS Date parsing/truncation/RangeError must not be approximated by SQLite.
 let updatedAt=now,timestampError:RangeError|undefined;
 // The Source base column is nullable. The erased assertion preserves NULL
 // into the exact JS expression (Date(null) is the epoch), without a default.
 if(selected)try{updatedAt=new Date(Math.max(Date.now(),new Date(selected.destination===oldUrl?now:selected.updated_at!).getTime()+1)).toISOString();}
 catch(cause){if(!(cause instanceof RangeError))throw cause;timestampError=cause;}
 const timestampValue=timestampError?sql`json_extract('[]',${INVALID_TIMESTAMP})`:sql`${updatedAt}`;
 const snapshot=equalUrls?sql`1`:selected?sql`EXISTS(SELECT 1 FROM _cms_redirects WHERE id=${selected.id}
  AND id=(SELECT id FROM _cms_redirects WHERE source=${oldUrl} LIMIT 1)
  AND source=${oldUrl} AND updated_at IS ${selected.updated_at} AND config_revision IS ${selected.config_revision} AND destination=${selected.destination})`
  :sql`NOT EXISTS(SELECT 1 FROM _cms_redirects WHERE source=${oldUrl})`;
 const generation=sql`(SELECT CAST(substr(token,${generationPrefix.length+1}) AS INTEGER)
  FROM _cms_guards WHERE substr(token,1,${generationPrefix.length})=${generationPrefix})`;
 const fence=sql`EXISTS(SELECT 1 FROM _cms_redirect_write_lock WHERE id=1 AND token=${token} AND generation=${generation})`;
 const statements:CompiledQuery[]=[
  // MUST be immediately after the actual content UPDATE. changes() excludes
  // trigger bookkeeping and rejects a stale UPDATE even if a later row happens
  // to carry the desired slug/version. CHECK failure rolls the entire batch back.
  sql`INSERT INTO _cms_guards(token,pass) VALUES(${casGuard},CASE WHEN changes()=1 THEN 1 ELSE 0 END)`.compile(db),
  sql`INSERT INTO _cms_guards(token,pass) VALUES(${snapshotGuard},CASE WHEN
   ${survives}=${survivor?1:0} AND (${survives} OR ${snapshot}) THEN 1 ELSE json_extract('[]',${SNAPSHOT_CHANGED}) END)`.compile(db),
  // Capture the acquisition's SET/RETURNING generation before its UPDATE in
  // this same physical batch. AFTER-UPDATE triggers cannot redefine the fence.
  sql`INSERT INTO _cms_guards(token,pass) SELECT ${generationPrefix}||CAST(generation+1 AS TEXT),1
   FROM _cms_redirect_write_lock WHERE id=1 AND NOT ${survives}`.compile(db),
  sql`UPDATE _cms_redirect_write_lock SET token=${token},expires_at=${clock+30_000},generation=generation+1
   WHERE id=1 AND (token='' OR expires_at<${clock}) AND NOT ${survives}`.compile(db),
  sql`INSERT INTO _cms_guards(token,pass) VALUES(${leaseGuard},CASE WHEN ${survives} OR changes()=1 THEN 1 ELSE json_extract('[]',${LEASE_BUSY}) END)`.compile(db),
  // Source acquires its lease before equal-URL early return. Such plans contain
  // no shadow/chain/source writes and have no redirect result indices.
  ...(equalUrls?[]:[
  // Source's surviving-locale check applies to drafts as well as published rows.
  // It precedes all shadow removal/chain changes; deleted holders do not count.
  sql`DELETE FROM _cms_redirects WHERE source=${newUrl} AND ${fence}`.compile(db),
  sql`UPDATE _cms_redirects SET destination=${newUrl},updated_at=${now},config_revision=${ulid()},write_generation=${generation}
   WHERE destination=${oldUrl} AND ${fence}`.compile(db),
  // On an existing source only destination/revision/timestamp change. Preserve
  // its manual/auto marker, type, enabled state, group, id and existing hit count.
  sql`UPDATE _cms_redirects SET destination=${newUrl},config_revision=${ulid()},write_generation=${generation},updated_at=${timestampValue}
   WHERE id=(SELECT id FROM _cms_redirects WHERE source=${oldUrl} LIMIT 1) AND ${fence}
   RETURNING id`.compile(db),
  sql`INSERT INTO _cms_redirects(id,source,destination,type,is_pattern,enabled,hits,last_hit_at,group_name,auto,
   config_revision,source_guard,write_generation,created_at,updated_at)
   SELECT ${ulid()},${oldUrl},${newUrl},301,0,1,0,NULL,'Auto: slug change',1,${ulid()},1,${generation},${now},${now}
   FROM _cms_redirect_write_lock WHERE id=1 AND ${fence}
    AND NOT EXISTS(SELECT 1 FROM _cms_redirects WHERE source=${oldUrl})
   RETURNING id`.compile(db)]),
  sql`INSERT INTO _cms_guards(token,pass) VALUES(${finalGuard},CASE WHEN ${survives} OR ${fence}
   THEN 1 ELSE json_extract('[]',${FENCE_CHANGED}) END)`.compile(db),
  sql`UPDATE _cms_redirect_write_lock SET token='',expires_at=0 WHERE id=1 AND token=${token}`.compile(db),
  sql`DELETE FROM _cms_guards WHERE token IN (${casGuard},${snapshotGuard},${leaseGuard},${finalGuard})
   OR substr(token,1,${generationPrefix.length})=${generationPrefix}`.compile(db)
 ];
 return {input,timestampError,statements,redirectResultIndices:equalUrls?[]:[7,8]};
}

/** Only the owned rollback sentinels retry; content/schema CAS remains strict. */
export async function executeContentSlugBatch(database:CmsDatabase,prefix:readonly CompiledQuery[],
 plan:ContentSlugRedirectBatch,suffix:readonly CompiledQuery[]):Promise<readonly QueryResult<unknown>[]> {
 for(let attempt=0;attempt<5;attempt++) {
  try{return await database.atomicBatch([...prefix,...plan.statements,...suffix]);}
  catch(cause){
   if(!(cause instanceof Error))throw cause;
   const occupied=cause.message.includes(LEASE_BUSY),changed=cause.message.includes(SNAPSHOT_CHANGED);
   if(!occupied&&!changed){
    if(cause.message.includes(INVALID_TIMESTAMP)&&plan.timestampError)throw plan.timestampError;
    if(cause.message.includes(FENCE_CHANGED))throw new Error('redirect write lease expired',{cause});throw cause;
   }
   // Source waits after all five failed acquisitions, including the fifth.
   if(occupied)await new Promise(resolve=>setTimeout(resolve,10*2**attempt));
   if(attempt===4){if(occupied)throw new RedirectWriteBusyError('Another redirect change is in progress');throw new CmsError('CONFLICT');}
   const refreshed=await prepareContentSlugRedirect(database,plan.input);
   if(!refreshed)throw new RedirectSchemaIncompleteError('Redirect storage changed while saving content');
   plan=refreshed;
  }
 }
 throw new Error('Unreachable redirect batch retry state');
}

/** Call only after successful actual atomicBatch, when its redirect result exists. */
export function completeContentSlugRedirect(
 database:CmsDatabase,defer?:((task:()=>void|Promise<void>)=>void)
):void {
 const db=database.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>();
 invalidateRedirectCache();invalidateDatabaseRedirectCache(db);
 after(()=>publishRedirectChanges(db),defer?task=>defer(()=>task):undefined);
}
