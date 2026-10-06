// Native domain composition of the pinned EmDashRuntime1692–1747 and complete
// setup route83–114. Runtime lifecycle and HTTP/auth/origin remain their owners.
import type {Kysely} from 'kysely';
import type {Database} from './upstream/database/types.ts';
import type {ValidationResult,SeedApplyOptions} from './types.ts';
import {OptionsRepository} from '../comments/upstream/database/repositories/options.ts';
import {initWithLock,type InitLock} from '../redirects/init-lock.ts';
import {AUTO_SEED_COMPLETE_OPTION} from './ownership.ts';
import {seedNativeActivateMediaUsageCapture} from './namespace.ts';
import {loadSeed} from './load.ts';
import {validateSeed} from './validate.ts';
import {applySeed,applySeedWithinBudget} from './index.ts';

/** The runtime supplies its real configured database key and existing holder.
 * The domain creates no global lock/cache, database or runtime lifecycle. */
export interface DefaultSeedParameters {
 databaseKey:string;
 holder:{lock:InitLock;done:Set<string>};
 deadlineMs:number;
 anchor?:(promise:Promise<void>)=>void;
 ownsConfiguredDatabase?:boolean;
}
export interface DefaultSeedOutcome {
 attempted:boolean;
 complete:boolean;
 validation?:ValidationResult;
 error?:unknown;
}
export async function initializeDefaultSeedDomain(db:Kysely<Database>,parameters:DefaultSeedParameters):Promise<DefaultSeedOutcome>{
 let seedComplete=true,setupDone=true,collectionsReadable=false;
 const options=new OptionsRepository(db);
 try{
  const stored=await options.getMany([AUTO_SEED_COMPLETE_OPTION,'emdash:setup_complete']);
  seedComplete=stored.get(AUTO_SEED_COMPLETE_OPTION)===true;
  setupDone=stored.get('emdash:setup_complete')===true;
 }catch{/* Exact Source gate: unreadable options never initiate auto-seeding. */}
 if(parameters.ownsConfiguredDatabase!==false){
  try{await db.selectFrom('_emdash_collections').select('slug').execute();collectionsReadable=true;}
  catch{/* A half-built collection catalogue must never trigger auto-seeding. */}
 }
 if(!collectionsReadable||seedComplete||setupDone)return{attempted:false,complete:seedComplete};
 // Source activation failure is fatal and precedes its nonfatal seed attempt.
 const activation=await seedNativeActivateMediaUsageCapture(db);
 if(activation.outcome!=='active')throw new Error('Fresh-site media usage activation did not complete');
 let validation:ValidationResult|undefined;
 try{
  const complete=await initWithLock(parameters.holder.lock,
   ()=>parameters.holder.done.has(parameters.databaseKey)?true:undefined,
   async()=>{
    const seed=await loadSeed();validation=validateSeed(seed);
    if(!validation.valid)return false;
    const result=await applySeed(db,seed,{onConflict:'skip'});
    await options.set(AUTO_SEED_COMPLETE_OPTION,true);
    console.log('Auto-seeded default collections');
    if(result.taxonomies.skipped>0)console.warn(`[auto-seed] Kept ${result.taxonomies.skipped} existing taxonomy definition(s) instead of the seed's. Edit them in the admin, or run \`emdash seed <file> --on-conflict update\` to replace them (this also overwrites other seeded records).`);
    parameters.holder.done.add(parameters.databaseKey);
    return true;
   },{deadlineMs:parameters.deadlineMs,anchor:parameters.anchor});
  return{attempted:true,complete,validation};
 }catch(error){return{attempted:true,complete:false,validation,error};}
}

/** Source setup reserves room for final HTTP state writes and storage work. */
export const SETUP_SEED_BUDGET=Object.freeze({queries:500,mediaDownloads:5});
export interface SetupSeedParameters {
 title:string;
 tagline?:string;
 includeContent?:boolean;
 storage?:SeedApplyOptions['storage'];
}
export type SetupSeedOutcome=
 |{validation:ValidationResult;seeded:null}
 |{validation:ValidationResult;seeded:Awaited<ReturnType<typeof applySeedWithinBudget>>};
export async function applySetupSeedWithinBudgetDomain(db:Kysely<Database>,parameters:SetupSeedParameters):Promise<SetupSeedOutcome>{
 const seed=await loadSeed();
 seed.settings={...seed.settings,title:parameters.title,tagline:parameters.tagline};
 const validation=validateSeed(seed);
 if(!validation.valid)return{validation,seeded:null};
 const seeded=await applySeedWithinBudget(db,seed,{includeContent:parameters.includeContent,onConflict:'skip',storage:parameters.storage},SETUP_SEED_BUDGET);
 return{validation,seeded};
}
