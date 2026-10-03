// Native per-database site settings cache; pinned MIT single-flight helpers remain unchanged.
import type { Kysely } from 'kysely';
import type { SettingsTables } from './tables.ts';
import type { SiteSettings } from './types.ts';
import { createSingleFlightCache, invalidateSingleFlightCache, type SingleFlightCache } from './vendor/single-flight-cache.ts';

const cacheKey = Symbol.for('sveltery:site-settings-values');
const sharedGlobal = globalThis as unknown as Record<symbol, unknown>;
const cacheState = (sharedGlobal[cacheKey] ??= {
  values: new WeakMap<object, SingleFlightCache<Partial<SiteSettings>>>()
}) as { values: WeakMap<object, SingleFlightCache<Partial<SiteSettings>>> };

export function siteCache(db: Kysely<SettingsTables>) {
  let cache = cacheState.values.get(db);
  if (!cache) {
    cache = createSingleFlightCache<Partial<SiteSettings>>();
    cacheState.values.set(db, cache);
  }
  return cache;
}

export function invalidateSiteSettingsCache(db?: Kysely<SettingsTables>) {
  if (db) {
    const cache = cacheState.values.get(db);
    if (cache) invalidateSingleFlightCache(cache);
  } else {
    cacheState.values = new WeakMap();
  }
}
