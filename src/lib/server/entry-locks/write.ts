import type {CmsDatabase} from '../database/contract.ts';
import {claimEntryLockForWrite,type EntryLockHolder,type EntryLockRefusal} from './handlers.ts';

/** Native exception envelope; the Source refusal body remains the sole holder decision. */
export class EntryLockRefusalError extends Error {
  readonly code='ENTRY_LOCKED';
  readonly details:EntryLockHolder;
  constructor(refusal:EntryLockRefusal){super(refusal.message);this.name='EntryLockRefusalError';this.details=refusal.details;}
}

/** Call only after the actual writer's trusted permission and ownership checks. */
export async function assertEntryLockWrite(database:CmsDatabase,collection:string,entryId:string,userId:string,overrideLock?:boolean):Promise<void>{
  const refusal=await claimEntryLockForWrite(database,collection,entryId,userId,{override:overrideLock});
  if(refusal)throw new EntryLockRefusalError(refusal);
}
