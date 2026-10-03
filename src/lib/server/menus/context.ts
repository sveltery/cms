import { AsyncLocalStorage } from 'node:async_hooks';
import type { Kysely } from 'kysely';
import type { Database } from './database-types.ts';
import type { DeferredTaskTracker } from '../redirects/deferred-tasks.ts';

export interface RequestContext {
  db?: Kysely<Database>;
  locale?: string;
  editMode: boolean;
  trailingSlash?: 'always' | 'never' | 'ignore';
  metrics?: { cacheHits: number; cacheMisses: number };
  preview?: { collection: string; id: string };
  dbIsIsolated?: boolean;
  routeCacheFill?: boolean;
  deferredTasks?: DeferredTaskTracker;
  keepAlive?: (task: Promise<void>) => void;
}
export type EmDashRequestContext = RequestContext;
const key = Symbol.for('sveltery:menus-request-context');
const state = globalThis as Record<symbol, unknown>;
const context = state[key] as AsyncLocalStorage<RequestContext> | undefined ?? (() => {
  const storage = new AsyncLocalStorage<RequestContext>(); state[key] = storage; return storage;
})();
export function runWithContext<T>(value: RequestContext, run: () => T): T { return context.run(value, run); }
export function getRequestContext(): RequestContext | undefined { return context.getStore(); }
