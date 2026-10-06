import { CacheNamespace, invalidateObjectCache } from '../menus/object-cache.ts';
/** MED-CACHE01: sole published cache namespace, after successful media deletion. */
export function invalidateSiteSettingsCache():void {
  invalidateObjectCache(CacheNamespace.SETTINGS);
}
