import { describe } from 'vitest';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { requireCronTaskStorage } from '../../../src/lib/server/cron/readiness.ts';
import { pluginSourceDatabase } from '../../../src/lib/server/plugins/database.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

export interface DialectTestContext {
  database: CmsDatabase;
  db: ReturnType<typeof pluginSourceDatabase>;
}
export function describeEachDialect(name: string, run: (dialect: 'sqlite') => void): void {
  describe(`${name} [actual canonical Node SQLite]`, () => run('sqlite'));
}
export async function setupForDialect(_dialect: 'sqlite'): Promise<DialectTestContext> {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    await requireCronTaskStorage(database);
    return { database, db: pluginSourceDatabase(database) };
  } catch (error) { await database.close(); throw error; }
}
export function teardownForDialect(context: DialectTestContext): Promise<void> { return context.database.close(); }
