import { describe } from 'vitest';
import { Miniflare } from 'miniflare';
import type { Kysely } from 'kysely';
import { openD1 } from '../../../src/lib/server/database/d1.ts';
import type { Database } from '../../../src/lib/server/redirects/database-types.ts';
import { installRedirectTables } from '../../../src/lib/server/redirects/migrations/index.ts';
import { waitForDeferredTasks } from '../../../src/lib/server/redirects/deferred-tasks.ts';
import { redirectNamespacePlugin } from './test-db.ts';

const owned = new WeakMap<object, { storage: ReturnType<typeof openD1>; worker: Miniflare }>();
export interface DialectTestContext { db: Kysely<Database>; dialect: 'd1' }

export async function setupForDialect(_dialect: 'd1'): Promise<DialectTestContext> {
  const worker = new Miniflare({ modules: true,
    script: 'export default {fetch() {return new Response("fixture")}}',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { DB: 'cms-whole-redirect-artifacts-d1' }, cf: false });
  const storage = openD1(await worker.getD1Database('DB'));
  const db = storage.db.withTables<{ [Name in keyof Database]: Database[Name] }>()
    .$pickTables<keyof Database>().withPlugin(redirectNamespacePlugin);
  owned.set(db, { storage, worker });
  try {
    // Complete owned Source redirect DDL; no canonical markers or startup claim.
    await installRedirectTables(db as unknown as Kysely<unknown>);
    return { db, dialect: 'd1' };
  } catch (cause) { await storage.close(); await worker.dispose(); throw cause; }
}

export function describeEachDialect(name: string, run: (dialect: 'd1') => void) {
  describe(`${name} [real workerd D1 explicit fixture]`, () => run('d1'));
}

export async function teardownForDialect(context: DialectTestContext | undefined) {
  await waitForDeferredTasks();
  const value = context && owned.get(context.db);
  if (value) { await value.storage.close(); await value.worker.dispose(); }
}
