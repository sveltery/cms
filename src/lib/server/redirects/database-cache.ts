import type { Kysely } from 'kysely';
import { createRedirectCache } from './cache.ts';

// Kysely's immutable typed/plugin wrappers retain this actual adapter object.
// Weak ownership keeps independent databases separate without caching principals
// or retaining the request's keepAlive callback.
const caches = new WeakMap<object, ReturnType<typeof createRedirectCache>>();

export function redirectCacheForDatabase<DB>(db: Kysely<DB>) {
  const owner = db.getExecutor().adapter;
  let cache = caches.get(owner);
  if (!cache) { cache = createRedirectCache(); caches.set(owner, cache); }
  return cache;
}

export function invalidateDatabaseRedirectCache<DB>(db: Kysely<DB>): void {
  caches.get(db.getExecutor().adapter)?.invalidateRedirectCache();
}
