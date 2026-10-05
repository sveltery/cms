import type { D1Database } from '@cloudflare/workers-types';
import { createRequestScopedDb, type D1Config } from './cloudflare-d1.ts';
import { SESSION_COOKIE_NAME } from '../auth/request.ts';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { createCmsHandle } from '../auth/composition.ts';
import type { D1Binding } from '../database/d1.ts';
import { openD1 } from '../database/d1.ts';
import { migrateCms } from '../database/migrations.ts';
import type { CmsDatabase } from '../database/contract.ts';
import type { Storage } from '../general-media/upstream/storage/types.ts';
import { resolveCmsRedirects } from '../redirects/middleware.ts';

export interface RuntimePresentation {
  /** Trusted injected provider; no default bucket or filesystem creation. */
  storage?: Storage;
  publicOrigin: string;
  basePath?: string;
  rpName?: string;
  mutationsEnabled?: boolean;
  keepAlive?: (task: Promise<void>) => void;
}
export type RuntimeConfiguration = RuntimePresentation & (
  { kind: 'sqlite'; path: string } |
  { kind: 'd1'; binding: D1Binding; d1?: D1Config }
);

export interface CmsRuntime {
  handle: Handle;
  close(): Promise<void>;
}

/** Request configuration is supplied by the hosting owner, never a client claim. */
export function createCmsRuntime(
  configuration: (event: RequestEvent) => RuntimeConfiguration | undefined | Promise<RuntimeConfiguration | undefined>
): CmsRuntime {
  const sqlite = new Map<string, Promise<CmsDatabase>>();
  const bindings = new Map<D1Binding, Promise<CmsDatabase>>();
  const configurations = new WeakMap<RequestEvent, RuntimeConfiguration>();
  let closed = false;
  let closing: Promise<void> | undefined;

  function assertOpen() {
    if (closed) throw new Error('CMS runtime is closed');
  }

  async function initialize(open: () => CmsDatabase | Promise<CmsDatabase>): Promise<CmsDatabase> {
    const database = await open();
    try {
      assertOpen();
      await migrateCms(database);
      assertOpen();
      return database;
    }
    catch (cause) { await database.close(); throw cause; }
  }

  function cachedAdapter<Key>(
    cache: Map<Key, Promise<CmsDatabase>>, key: Key, open: () => CmsDatabase | Promise<CmsDatabase>
  ): Promise<CmsDatabase> {
    let pending = cache.get(key);
    if (!pending) {
      pending = initialize(open);
      cache.set(key, pending);
      const initialized = pending;
      void pending.catch(() => { if (cache.get(key) === initialized) cache.delete(key); });
    }
    return pending;
  }

  function databaseFor(config: RuntimeConfiguration): Promise<CmsDatabase> {
    if (config.kind === 'sqlite') {
      const path = config.path;
      if (typeof path !== 'string' || !path.trim() || path.includes('\0') || path === ':memory:') {
        throw new Error('SVELTERY_DATABASE_PATH must name a persistent SQLite file');
      }
      return cachedAdapter(sqlite, path, async () => {
        const { openRuntimeSqlite } = await import('./node.ts');
        assertOpen();
        return openRuntimeSqlite(path);
      });
    }
    const binding = config.binding;
    if (!binding || typeof binding.prepare !== 'function' || typeof binding.batch !== 'function') {
      throw new Error('CMS_DB must be a raw D1 database binding declared in d1_databases');
    }
    return cachedAdapter(bindings, binding, () => openD1(binding));
  }

  const sessionHandle = createCmsHandle(async event => {
    assertOpen();
    const config = await configuration(event);
    assertOpen();
    if (!config) return undefined;
    const { publicOrigin, basePath = '', rpName = 'Sveltery CMS' } = config;
    let parsed: URL;
    try { parsed = new URL(publicOrigin); }
    catch { throw new Error('SVELTERY_PUBLIC_ORIGIN must be an exact HTTP or HTTPS origin'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== publicOrigin) {
      throw new Error('SVELTERY_PUBLIC_ORIGIN must be an exact HTTP or HTTPS origin');
    }
    if (basePath !== '' && (!basePath.startsWith('/') || basePath.startsWith('//') || basePath.endsWith('/'))) {
      throw new Error('CMS base path must be an absolute path without a trailing slash');
    }
    if (typeof rpName !== 'string' || !rpName.trim()) throw new Error('SVELTERY_RP_NAME must be nonempty');
    const database = await databaseFor(config);
    assertOpen();
    event.locals.cmsRuntime = Object.freeze({ publicOrigin, basePath, rpName });
    configurations.set(event, config);
    return { database, mutationsEnabled: config.mutationsEnabled !== false, keepAlive: config.keepAlive, storage: config.storage };
  });

  return {
    handle: async input => {
      const resolvePage: typeof input.resolve = (event, options) =>
        resolveCmsRedirects(event, () => input.resolve(event, options));
      delete input.event.locals.cmsRuntime;
      try {
        return await sessionHandle({ ...input, resolve: async (event, options) => {
          assertOpen();
          const config = configurations.get(event);
          if (config?.kind !== 'd1' || !config.d1) return resolvePage(event, options);
          const cookies = event.cookies;
          // Kit can replace its public setter in resolve's finally. Preserve the
          // jar handoff for a propagating error before the outer error response.
          const setErrorCookie = cookies.set.bind(cookies);
          let outgoingSession = false;
          event.cookies = new Proxy(cookies, { get(target, key) {
            if (key === 'set') return (...args: Parameters<typeof cookies.set>) => {
              if (args[0] === SESSION_COOKIE_NAME) outgoingSession = true;
              return cookies.set(...args);
            };
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
          } });
          const isAuthenticated = !!event.locals.cms?.principal;
          const bookmarks: string[] = [];
          let renderingFailed = false;
          const scoped = createRequestScopedDb({
            config: config.d1, binding: config.binding as D1Database,
            isAuthenticated, endedAuthenticated: () => isAuthenticated || outgoingSession,
            isWrite: !['GET', 'HEAD'].includes(event.request.method), url: event.url,
            cookies: {
              get: name => { const value = cookies.get(name); return value === undefined ? undefined : { value }; },
              set: (name, value, options) => {
                if (renderingFailed) setErrorCookie(name, value, options as unknown as Parameters<typeof cookies.set>[2]);
                else bookmarks.push(cookies.serialize(name, value, options as unknown as Parameters<typeof cookies.serialize>[2]));
              }
            }
          });
          try {
            if (!scoped) return await resolvePage(event, options);
            event.locals.cms = Object.freeze({ ...event.locals.cms!, database: scoped.database });
            let response: Response;
            try { response = await resolvePage(event, options); }
            catch (cause) {
              renderingFailed = true;
              try { scoped.commit(); }
              catch (commitError) { console.error('CMS D1 bookmark commit failed during error handling', commitError); }
              throw cause;
            }
            scoped.commit();
            // Kit forbids cookies.set after resolve. Serialization plus response headers
            // preserves the pinned commit timing and cookie options on the native boundary.
            if (bookmarks.length) {
              const headers = new Headers(response.headers);
              for (const bookmark of bookmarks) headers.append('set-cookie', bookmark);
              response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
            }
            // D1 has no connection teardown. Stream/deferred readers retain this request's db.
            return response;
          } finally { event.cookies = cookies; }
        } });
      } catch (cause) {
        if (closed) {
          delete input.event.locals.cms;
          delete input.event.locals.cmsRuntime;
        }
        throw cause;
      } finally { configurations.delete(input.event); }
    },
    close() {
      closed = true;
      closing ??= (async () => {
        const pending = [...sqlite.values(), ...bindings.values()];
        sqlite.clear(); bindings.clear();
        const initialized = await Promise.allSettled(pending);
        await Promise.all(initialized.filter(result => result.status === 'fulfilled')
          .map(result => result.value.close()));
      })();
      return closing;
    }
  };
}
