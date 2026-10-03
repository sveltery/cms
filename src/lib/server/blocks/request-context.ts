// Native read-only host adapter. The Node host owns the actual context storage.
// Worker/library callers without an installed context follow the pinned cache fallback.
import type { EmDashRequestContext } from '../taxonomies/upstream/request-context.ts';
export type { EmDashRequestContext } from '../taxonomies/upstream/request-context.ts';

interface RequestContextStorage {
  getStore(): EmDashRequestContext | undefined;
}

export function getRequestContext(): EmDashRequestContext | undefined {
  const storage = (globalThis as Record<symbol, unknown>)[Symbol.for('emdash:request-context')] as RequestContextStorage | undefined;
  return storage?.getStore();
}
