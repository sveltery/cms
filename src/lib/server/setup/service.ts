import {z} from 'zod';
import type {IdentityContext} from '../auth/passkey-flow.ts';
import {AuthFlowError,setupStatus} from '../auth/passkey-flow.ts';
import {identityOptions} from '../auth/identity-store.ts';
import {OptionsRepository} from '../settings/options.ts';
import {settingsDb} from '../settings/index.ts';
import {applySetupSeed,SetupSeedError,SetupSeedUnsupportedError,type SetupSeedDependencies} from './seed.ts';
import {setupSeedDependencies} from './seed-providers.ts';
import {defaultSeed} from './upstream/default.ts';
import type {SeedFile} from './upstream/types.ts';
// Exact selected setupBody declaration at immutable EmDash1.1.0; MIT2026 Cloudflare Inc.
export const setupBody=z.object({title:z.string().min(1),tagline:z.string().optional(),includeContent:z.boolean()});
export async function assertSiteSetupOpen(context:IdentityContext){
 // Native wizard availability comes only from the trusted auth authority.
 // Historical minimal users must not acquire options or seed writes here.
 const status=await setupStatus(context);
 if('unavailable' in status&&status.unavailable)throw new AuthFlowError(status.reason,503);
 const complete=await identityOptions(context.database).get('emdash:setup_complete');
 if(complete===true||complete==='true')throw new AuthFlowError('ALREADY_CONFIGURED',409);
}
export async function setupSite(context:IdentityContext,input:unknown,configuredSeed?:SeedFile,dependencies:SetupSeedDependencies=setupSeedDependencies){
 await assertSiteSetupOpen(context);
 const parsed=setupBody.safeParse(input);if(!parsed.success)throw new AuthFlowError('VALIDATION_ERROR');
 const body=parsed.data,seed=structuredClone(configuredSeed??defaultSeed);
 seed.settings={...seed.settings,title:body.title,tagline:body.tagline};
 let seeded:Awaited<ReturnType<typeof applySetupSeed>>;
 try{seeded=await applySetupSeed(context.database,seed,body.includeContent,dependencies);}
 catch(cause){if(cause instanceof SetupSeedUnsupportedError)throw new AuthFlowError('UNSUPPORTED_SEED',400);throw new SetupSeedError('Failed to apply seed');}
 const {result,complete:seedComplete,progress:seedProgress}=seeded;
 try{
  await new OptionsRepository(settingsDb(context.database)).setIfAbsent('emdash:site_url',context.publicOrigin);
  if(seedComplete)await identityOptions(context.database).set('emdash:setup_state',{step:'site_complete',title:body.title,tagline:body.tagline});
 }catch(error){console.error('Failed to save setup state:',error);/* Exact source non-fatal boundary. */}
 return {success:true,setupComplete:false,seedComplete,...(!seedComplete?{seedProgress}:{}),result};
}
