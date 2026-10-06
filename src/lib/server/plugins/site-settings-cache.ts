import { createSingleFlightCache, invalidateSingleFlightCache, type SingleFlightCache } from '../redirects/single-flight-cache.ts';
import { invalidateObjectCache } from '../menus/object-cache.ts';
const key = Symbol.for('emdash:site-settings');
const globalCaches = globalThis as Record<symbol, unknown>;
const settingsCache = (globalCaches[key] as SingleFlightCache<Record<string, unknown>> | undefined) ?? createSingleFlightCache<Record<string, unknown>>();
globalCaches[key] = settingsCache;
/** Native binding for the complete pinned cache invalidation operation, without a second settings store. */
export function invalidateSiteSettingsCache(): void {
  invalidateSingleFlightCache(settingsCache);
  invalidateObjectCache('settings');
}
