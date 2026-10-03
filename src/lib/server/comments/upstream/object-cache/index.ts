import { commentRequestScope } from '../loader.ts';
export const CacheNamespace = { COMMENTS: 'comments' } as const;
/** Native request-local cache; no isolate/global database or principal capture. */
export function cachedQuery<T>(options: { namespace: string; key: string; load: () => Promise<T> }): Promise<T> {
  const scope = commentRequestScope.getStore();
  if (!scope) return options.load();
  const key = `${options.namespace}:${options.key}`;
  const existing = scope.cache.get(key);
  if (existing) return existing as Promise<T>;
  const pending = options.load();
  scope.cache.set(key, pending);
  void pending.catch(() => { if (scope.cache.get(key) === pending) scope.cache.delete(key); });
  return pending;
}
export function invalidateCommentObjectCache(): void {
  commentRequestScope.getStore()?.cache.clear();
}
