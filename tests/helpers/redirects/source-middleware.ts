import type { RedirectContext } from '../../../src/lib/server/redirects/engine.ts';
import { runRedirectMiddleware } from '../../../src/lib/server/redirects/engine.ts';
import { getDb } from './loader.ts';

type SourceContext = Omit<RedirectContext, 'db' | 'getDb'> & {
  locals: { emdash?: { db?: RedirectContext['db'] } };
};

// Test-only Astro transport. The unchanged Source callback/fixtures exercise
// the actual native engine, repository, artifacts and default Source cache.
export function onRequest(context: SourceContext, next: () => Promise<Response>) {
  return runRedirectMiddleware({ ...context, db: context.locals.emdash?.db, getDb }, next);
}
