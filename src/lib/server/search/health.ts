import type {Kysely} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import type {Database} from '../database/lifecycle/upstream/database/types.ts';
import {FTSManager} from './fts-manager.ts';
import {createSingleFlightCache,singleFlightCached,type SingleFlightCache} from '../settings/vendor/single-flight-cache.ts';
const caches=new WeakMap<CmsDatabase,SingleFlightCache<void>>();
/** Pinned EmDashRuntime.ensureSearchHealthy: lazy once per isolate, best effort,
 * source poison-immune single flight and the current request's lifetime anchor.
 * Always captures the primary runtime adapter, before request D1 read sessions.
 */
export function searchHealth(database:CmsDatabase,keepAlive?: (task:Promise<void>)=>void) {
 let cache=caches.get(database);if(!cache){cache=createSingleFlightCache<void>();caches.set(database,cache);}
 const captured=cache;
 return async()=>{
  try {
   await singleFlightCached(captured,async()=>{
    try {
     const repaired=await new FTSManager(database.db as unknown as Kysely<Database>).verifyAndRepairAll();
     if(repaired>0)console.log(`Repaired ${repaired} corrupted FTS index(es)`);
    }catch{ /* The source caches a completed check even before setup. */ }
   },{anchor:promise=>keepAlive?.(promise),ownerTimeoutMs:30_000});
  }catch{ /* Health checking cannot fail the requesting search response. */ }
 };
}
