import { sql } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

/** Restore the historical empty Main8 object-name fixture in its isolated DB. */
export async function prepareOpaqueMediaIndexFixture(database: CmsDatabase): Promise<void> {
  const result = await sql<{ rows: number }>`SELECT COUNT(*) AS rows FROM _cms_media`.execute(database.db);
  if (result.rows.length !== 1 || Number(result.rows[0].rows) !== 0) {
    throw new Error('Opaque media index fixture requires a fresh empty media table');
  }
  await sql`DROP TABLE _cms_media`.execute(database.db);
}
