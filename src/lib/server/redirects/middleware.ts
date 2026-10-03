import type { RequestEvent } from '@sveltejs/kit';
import { redirectCacheForDatabase } from './database-cache.ts';
import { createDatabaseRedirectSource } from './artifacts.ts';
import type { Database } from './database-types.ts';
import { runRedirectMiddleware } from './engine.ts';
import { after } from './after.ts';
import { redirectSchemaPresent } from './readiness.ts';

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
  const currentCache = redirectCacheForDatabase(db);
  const defer: typeof after = fn => after(fn, configured.keepAlive);
  let disableCache = false;
  const response = await runRedirectMiddleware({
    url: event.url, request: event.request, db,
    getDb: async () => db,
    redirect: (location, status) => new Response(null, { status, headers: { Location: location } }),
    cache: { set: () => { disableCache = true; } },
    keepAlive: configured.keepAlive,
    loadRedirects: source => currentCache.loadCachedRedirects(source, defer),
    createSource: sourceDb => createDatabaseRedirectSource(sourceDb, defer)
  }, next);
  if (!disableCache) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
