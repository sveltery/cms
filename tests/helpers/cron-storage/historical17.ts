// Native setup only: install the real frozen public providers1–17 in order.
// No invented provider/marker or Source migration-runner claim.
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { CMS_MIGRATIONS } from '../../../src/lib/server/database/migrations.ts';
import { installVersion4 } from '../lifecycle-startup.ts';
export async function installHistorical17(database: CmsDatabase) {
  await installVersion4(database);
  for (const provider of CMS_MIGRATIONS.filter(provider => provider.version >= 5 && provider.version <= 17)) {
    const prepared = await provider.prepare?.(database);
    await database.atomicBatch([...(prepared?.guards ?? []), ...(prepared?.statements ?? await provider.statements(database)),
      sql`INSERT INTO _cms_migrations(version) VALUES (${sql.lit(provider.version)})`.compile(database.db)]);
  }
  const versions = await database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute();
  assert.deepEqual(versions.map(row => row.version), Array.from({ length: 17 }, (_, index) => index + 1));
}
