import type { RequestEvent } from '@sveltejs/kit';
import { createRedirectCache } from './cache.ts';
import type { Database } from './database-types.ts';
import { runRedirectMiddleware } from './engine.ts';
import { after } from './after.ts';
import { redirectSchemaPresent } from './readiness.ts';

const caches = new WeakMap<object, ReturnType<typeof createRedirectCache>>();
const internalPaths = ['/schema', '/content', '/trash', '/setup', '/login', '/api', '/redirects'];

function nativeInternalPath(pathname: string, base: string): boolean {
  const path = base && pathname === base ? '/' :
    base && pathname.startsWith(base + '/') ? pathname.slice(base.length) : pathname;
  return path === '/' || internalPaths.some(prefix => path === prefix || path.startsWith(prefix + '/'));
}

/** Trusted native route/database adapter around the complete pinned rule engine. */
export async function resolveCmsRedirects(event: RequestEvent, next: () => Promise<Response>): Promise<Response> {
  if (nativeInternalPath(event.url.pathname, event.locals.cmsRuntime?.basePath ?? '')) return next();
  const configured = event.locals.cms;
  if (!configured) return next();
  const db = configured.database.db.withTables<{ [Name in keyof Database]: Database[Name] }>().$pickTables<keyof Database>();
  let installed: boolean;
  try {
    installed = await redirectSchemaPresent(db);
  } catch {
    // Preserve Source's broad storage-error fallback, including partial installs.
    return next();
  }
  // Absence preserves the actual unregistered main resolver, including errors.
  if (!installed) return next();
  let cache = caches.get(configured.database.db);
  if (!cache) { cache = createRedirectCache(); caches.set(configured.database.db, cache); }
  const currentCache = cache;
  let disableCache = false;
  const response = await runRedirectMiddleware({
    url: event.url, request: event.request, db,
    getDb: async () => db,
    redirect: (location, status) => new Response(null, { status, headers: { Location: location } }),
    cache: { set: () => { disableCache = true; } },
    keepAlive: configured.keepAlive,
    loadRedirects: source => currentCache.loadCachedRedirects(source, fn => after(fn, configured.keepAlive))
  }, next);
  if (!disableCache) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
