import type { CmsTables } from '../database/contract.ts';

/** Canonical storage for the complete Source075 six-column lease row. */
export interface EntryLockTable {
  collection: string;
  entry_id: string;
  user_id: string;
  token: string;
  acquired_at: string;
  expires_at: string;
}
export interface EntryLockTables extends CmsTables {
  _cms_entry_locks: EntryLockTable;
}
