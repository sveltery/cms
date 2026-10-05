import type { CmsDatabase } from '../database/contract.ts';
import { getRequestContext, runWithContext } from '../menus/context.ts';

// Exact original Native constructor scope extracted before its request-cache
// regression test. This creates no SQL connection, migrations or cache backend.
export function createQueryScope(database: CmsDatabase) {
  return function scoped<T>(read: () => T): T {
    const context = getRequestContext();
    if (context?.db) return read();
    return runWithContext({...context, editMode: context?.editMode ?? false,
      db: database.db as unknown as NonNullable<typeof context>['db']}, read);
  };
}
