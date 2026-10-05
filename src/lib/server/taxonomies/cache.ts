import type { CmsDatabase } from '../database/contract.ts';
const invalidators = new WeakMap<CmsDatabase, (tags: string[]) => Promise<void>>();
/** Trusted host supplies its configured cache backend; request input never does. */
export function registerTaxonomyCacheInvalidator(database: CmsDatabase, invalidate: (tags:string[])=>Promise<void>): void {
  invalidators.set(database,invalidate);
}
export const taxonomyCacheInvalidator = (database:CmsDatabase) => invalidators.get(database);
