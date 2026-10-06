import type { Kysely } from 'kysely';
import type { Database } from './upstream/database/types.ts';
import { registeredBylineDatabaseOwner } from '../bylines/storage.ts';
import { registeredSeedDatabaseOwner, seedSourceDatabase } from './namespace.ts';
import { applySeed as apply, applySeedWithinBudget as applyWithinBudget } from './apply.ts';
import {applySeed as nativeD1Apply,applySeedWithinBudget as nativeD1Budget} from './apply-d1.ts';
import {RawBindingD1Adapter} from '../database/d1.ts';
export type * from './apply.ts';

/** Reuse a trusted existing canonical owner; never create a second database. */
function applicationHandle(db: Kysely<Database>): Kysely<Database> {
  if (registeredSeedDatabaseOwner(db)) return db;
  const owner = registeredBylineDatabaseOwner(db as unknown as Parameters<typeof registeredBylineDatabaseOwner>[0]);
  if (!owner) throw new Error('Seed application requires the actual registered CMS database owner');
  return seedSourceDatabase(owner);
}
export const applySeed: typeof apply = (db, ...arguments_) => {const handle=applicationHandle(db);return (handle.getExecutor().adapter instanceof RawBindingD1Adapter?nativeD1Apply:apply)(handle,...arguments_);};
export const applySeedWithinBudget: typeof applyWithinBudget = (db, ...arguments_) => {const handle=applicationHandle(db);return (handle.getExecutor().adapter instanceof RawBindingD1Adapter?nativeD1Budget:applyWithinBudget)(handle,...arguments_);};
export type {DefaultSeedParameters,DefaultSeedOutcome,SetupSeedParameters,SetupSeedOutcome} from './startup.ts';
export {SetupSeedApplyError} from './startup-errors.ts';
/** Real domain entrypoints load only when their runtime/HTTP caller invokes them. */
export async function initializeDefaultSeed(db:Kysely<Database>,parameters:import('./startup.ts').DefaultSeedParameters){const actual=await import('./startup.ts');return actual.initializeDefaultSeedDomain(applicationHandle(db),parameters);}
export async function applySetupSeedWithinBudget(db:Kysely<Database>,parameters:import('./startup.ts').SetupSeedParameters){const actual=await import('./startup.ts');return actual.applySetupSeedWithinBudgetDomain(applicationHandle(db),parameters);}
