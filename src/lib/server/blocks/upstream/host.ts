import type { CmsDatabase } from '../../database/contract.ts';
const hosts = new WeakMap<object, CmsDatabase>();
export function registerBlockDatabaseHost(database: CmsDatabase): void { hosts.set(database.db, database); }
export function blockDatabaseHost(db: object): CmsDatabase | undefined { return hosts.get(db); }
