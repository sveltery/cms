import type { ContentPickerClient, ContentItem, FindManyResult, PickerManifest } from './types.ts';
export interface CachedQuery { pages: FindManyResult<ContentItem>[]; pending?: Promise<FindManyResult<ContentItem>[]>; error?: unknown; listeners: Set<() => void> }
export interface PickerCache { collections?: { slug: string; label: string }[]; manifest?: PickerManifest; queries: Map<string, CachedQuery> }
const caches = new WeakMap<ContentPickerClient, PickerCache>();
export function pickerCache(client: ContentPickerClient): PickerCache {
  let cache = caches.get(client); if (!cache) { cache = { queries: new Map() }; caches.set(client, cache); } return cache;
}
export function pickerQuery(cache: PickerCache, collection: string, search: string) {
  const key = JSON.stringify([collection, search]); let query = cache.queries.get(key);
  if (!query) { query = { pages: [], listeners: new Set() }; cache.queries.set(key, query); } return query;
}
export function notifyQuery(query: CachedQuery) { for (const listener of query.listeners) listener(); }
