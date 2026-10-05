import type { Kysely } from 'kysely';
import type { Database } from './upstream/database/types.ts';
import { registeredBylineDatabaseOwner } from '../bylines/storage.ts';
import { registeredSeedDatabaseOwner, seedSourceDatabase } from './namespace.ts';
import { applySeed as apply, applySeedWithinBudget as applyWithinBudget } from './apply.ts';
export type * from './apply.ts';

/** Reuse a trusted existing canonical owner; never create a second database. */
function applicationHandle(db: Kysely<Database>): Kysely<Database> {
  if (registeredSeedDatabaseOwner(db)) return db;
  const owner = registeredBylineDatabaseOwner(db as unknown as Parameters<typeof registeredBylineDatabaseOwner>[0]);
  if (!owner) throw new Error('Seed application requires the actual registered CMS database owner');
  return seedSourceDatabase(owner);
}
export const applySeed: typeof apply = (db, ...arguments_) => apply(applicationHandle(db), ...arguments_);
export const applySeedWithinBudget: typeof applyWithinBudget = (db, ...arguments_) => applyWithinBudget(applicationHandle(db), ...arguments_);
