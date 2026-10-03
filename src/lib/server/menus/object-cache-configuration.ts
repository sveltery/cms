import type { CreateObjectCacheBackendFn, ObjectCacheRuntimeConfig } from './object-cache-types.ts';
interface Configuration { createObjectCache?: CreateObjectCacheBackendFn; objectCacheConfig?: ObjectCacheRuntimeConfig }
const key = Symbol.for('sveltery:menus-object-cache:configuration');
const state = globalThis as Record<symbol, unknown>;
/** Trusted server startup configuration replaces Astro's generated virtual module. */
export function configureMenuObjectCache(configuration: Configuration): void {
  state[key] = Object.freeze({ ...configuration, objectCacheConfig: Object.freeze({ ...configuration.objectCacheConfig }) });
}
export function configuredMenuObjectCache(): Configuration { return state[key] as Configuration ?? {}; }
