// Explicit complete Source026 fixture. No namespace rewriting or canonical-startup credit.
import { describe, inject } from 'vitest';
import type { Kysely } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { schemaAdminStorage } from '../schema-admin-storage.ts';
import { up } from '../../../parity/emdash/cron-storage-source/upstream/packages/core/src/database/migrations/026_cron_tasks.ts';
import type { CronTaskTable } from '../../../parity/emdash/cron-storage-source/upstream/packages/core/src/database/types.ts';
type Tables = { _emdash_cron_tasks: CronTaskTable };
declare module 'vitest' {
  export interface ProvidedContext { cronStorageDialects: ('sqlite' | 'd1')[] }
}
export interface DialectTestContext { db: Kysely<Tables>; owner: CmsDatabase; close(): Promise<void> }
export async function setupForDialect(dialect: 'sqlite' | 'd1'): Promise<DialectTestContext> {
  const storage = await schemaAdminStorage(dialect === 'sqlite' ? 'Node' : 'D1');
  try {
    await up(storage.database.db as unknown as Kysely<unknown>);
    return { db: storage.database.db as unknown as Kysely<Tables>, owner: storage.database, close: storage.close };
  } catch (cause) { await storage.close(); throw cause; }
}
export async function teardownForDialect(context: DialectTestContext | undefined) { await context?.close(); }
export function describeEachDialect(name: string, callback: (dialect: 'sqlite' | 'd1') => void) {
  for (const dialect of inject('cronStorageDialects')) describe(name + ' [explicit Source physical ' + dialect + ']', () => callback(dialect));
}
