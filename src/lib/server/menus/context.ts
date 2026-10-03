import { AsyncLocalStorage } from 'node:async_hooks';
import type { Kysely } from 'kysely';
import type { Database } from './database-types.ts';

export interface RequestContext {
  db?: Kysely<Database>;
  locale?: string;
  editMode: boolean;
  trailingSlash?: 'always' | 'never' | 'ignore';
  metrics?: { cacheHits: number; cacheMisses: number };
}
const context = new AsyncLocalStorage<RequestContext>();
export function runWithContext<T>(value: RequestContext, run: () => T): T { return context.run(value, run); }
export function getRequestContext(): RequestContext | undefined { return context.getStore(); }
