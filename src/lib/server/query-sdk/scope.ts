import type { CmsDatabase } from '../database/contract.ts';
import { getRequestContext, runWithContext, type RequestContext } from '../menus/context.ts';

// Bind a database without changing the original request object. A stable view
// lets the existing request-cache owner identify repeated reads in one request.
export function createQueryScope(database: CmsDatabase) {
  const views = new WeakMap<RequestContext, RequestContext>();
  return function scoped<T>(read: () => T): T {
    const context = getRequestContext();
    if (context?.db) return read();
    let view = context && views.get(context);
    if (!view) {
      view = {...context, editMode: context?.editMode ?? false,
        db: database.db as unknown as RequestContext['db']};
      if (context) views.set(context, view);
    }
    return runWithContext(view, read);
  };
}
