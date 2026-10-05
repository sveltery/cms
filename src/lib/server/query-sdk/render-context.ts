import type { RequestEvent } from '@sveltejs/kit';
import { bindQueryDatabase } from './bindings.ts';
import { createQueryScope } from './scope.ts';

// Use final trusted request storage after any D1 scope replacement. The whole
// render shares the existing menus ALS/cache owner with query and page helpers.
// Configuration, authorization, locale and preview remain their existing owners.
export function withQueryRenderRequest<T>(
  event: Pick<RequestEvent, 'locals'>,
  render: () => T
): T {
  const configuration = event.locals.cms;
  if (!configuration) return render();
  bindQueryDatabase(configuration.database);
  return createQueryScope(configuration.database, {keepAlive: configuration.keepAlive})(render);
}
