import type { Handle, RequestEvent } from '@sveltejs/kit';
import { createCmsHandle } from '../auth/composition.ts';
import type { D1Binding } from '../database/d1.ts';
import { openD1 } from '../database/d1.ts';
import { migrateCms } from '../database/migrations.ts';
import type { CmsDatabase } from '../database/contract.ts';

export interface RuntimePresentation {
  publicOrigin: string;
  basePath?: string;
  rpName?: string;
  mutationsEnabled?: boolean;
  keepAlive?: (task: Promise<void>) => void;
}
export type RuntimeConfiguration = RuntimePresentation & (
  { kind: 'sqlite'; path: string } |
  { kind: 'd1'; binding: D1Binding }
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
  let closed = false;
  let closing: Promise<void> | undefined;

  async function initialize(open: () => CmsDatabase | Promise<CmsDatabase>): Promise<CmsDatabase> {
    const database = await open();
    try {
      if (closed) throw new Error('CMS runtime is closed');
      await migrateCms(database);
      if (closed) throw new Error('CMS runtime is closed');
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
        if (closed) throw new Error('CMS runtime is closed');
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
    if (closed) throw new Error('CMS runtime is closed');
    const config = await configuration(event);
    if (closed) throw new Error('CMS runtime is closed');
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
    if (closed) throw new Error('CMS runtime is closed');
    event.locals.cmsRuntime = Object.freeze({ publicOrigin, basePath, rpName });
    return { database, mutationsEnabled: config.mutationsEnabled !== false, keepAlive: config.keepAlive };
  });

  return {
    handle: async input => {
      delete input.event.locals.cmsRuntime;
      try {
        return await sessionHandle({ ...input, resolve: (event, options) => {
          if (closed) throw new Error('CMS runtime is closed');
          return input.resolve(event, options);
        } });
      } catch (cause) {
        if (closed) {
          delete input.event.locals.cms;
          delete input.event.locals.cmsRuntime;
        }
        throw cause;
      }
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
