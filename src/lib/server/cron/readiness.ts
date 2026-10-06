// Read-only canonical capability. No DDL, migration, repair or raw SQL executor.
import { sql } from 'kysely';
import { CmsError, type CmsDatabase } from '../database/contract.ts';
import { sqliteErrorMessage } from '../database/errors.ts';
import { normalizeFeatureStorageSql } from '../database/canonical-features/sql-recognition.ts';
import { cronTaskStorageDescriptor } from './storage-provider.ts';

/** Only a real complete canonical1–18 installation grants Cron storage readiness. */
export async function requireCronTaskStorage(database: CmsDatabase): Promise<void> {
  let markers;
  try { markers = await database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute(); }
  catch (cause) {
    if (/no such (?:table|column): (?:_cms_migrations|version)(?:\b|$)/.test(sqliteErrorMessage(cause) ?? '')) throw new CmsError('MIGRATION_REQUIRED');
    throw cause;
  }
  if (markers.length !== 18 || markers.some((row, index) => row.version !== index + 1)) throw new CmsError('MIGRATION_REQUIRED');
  const expected = cronTaskStorageDescriptor.expectedObjects(database);
  const objects = (await sql<{ name: string; type: string; sql: string | null }>`SELECT name,type,sql FROM sqlite_master
    WHERE lower(name) IN (${sql.join(expected.map(object => sql`${object.name}`))})`.execute(database.db)).rows;
  const actual = new Map(objects.map(object => [object.name, object]));
  for (const object of expected) {
    const stored = actual.get(object.name);
    if (!stored || stored.type !== object.type || stored.sql === null ||
      normalizeFeatureStorageSql(stored.sql) !== normalizeFeatureStorageSql(object.sql)) throw new CmsError('MIGRATION_REQUIRED');
  }
}
