/** Bounded menu object-cache adapter. Broader EmDash object-cache APIs are unported. */
export interface ObjectCacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
let backend: ObjectCacheBackend | null = null;
let ttl = 3_600_000;
let generation = 0;
const knownKeys = new Set<string>();
export const CacheNamespace = { MENUS: 'menus' } as const;
export function __setObjectCacheBackendForTests(value: ObjectCacheBackend | null, options: { revalidate?: number; defaultTtl?: number } = {}) {
  backend = value;
  ttl = (options.defaultTtl ?? 3600) * 1000;
  generation++;
  knownKeys.clear();
}
export async function cachedQuery<T>(options: { namespace: string; key: string; load: () => Promise<T> }): Promise<T> {
  if (!backend) return options.load();
  const active = backend;
  const epoch = generation;
  const key = `${options.namespace}:${options.key}`;
  const cached = await active.get(key);
  if (cached !== null) {
    try {
      const entry = JSON.parse(cached) as { expires: number; value: T };
      if (entry.expires > Date.now()) return entry.value;
    } catch { /* A malformed cache entry is reloaded from storage. */ }
  }
  const value = await options.load();
  if (backend === active && generation === epoch) {
    knownKeys.add(key);
    await active.set(key, JSON.stringify({ expires: Date.now() + ttl, value }));
  }
  return value;
}
export function invalidateMenuObjectCache(): void {
  generation++;
  const active = backend;
  if (!active) return;
  const keys = [...knownKeys];
  knownKeys.clear();
  void Promise.all(keys.map(key => active.delete(key))).catch(() => undefined);
}
