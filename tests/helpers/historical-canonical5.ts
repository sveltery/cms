// Explicit actual historical1–5 fixture for whole feature schema/readiness cases.
// Zero ordinary latest canonical installation or Source callback credit.
import { sql } from 'kysely';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { CMS_MIGRATIONS } from '../../src/lib/server/database/migrations.ts';
import { installVersion4 } from './lifecycle-startup.ts';

export async function installHistoricalCanonical5(database: CmsDatabase): Promise<void> {
  await installVersion4(database);
  const lifecycle = CMS_MIGRATIONS.find(provider => provider.version === 5);
  if (!lifecycle) throw new Error('The immutable actual lifecycle5 provider is missing');
  await database.atomicBatch([...await lifecycle.statements(database),
    sql`INSERT INTO _cms_migrations(version) VALUES (5)`.compile(database.db)]);
}

/** Real public1–8 fixture; retains every incoming canonical8 readiness assertion. */
export async function installHistoricalCanonical8(database: CmsDatabase): Promise<void> {
  await installHistoricalCanonical5(database);
  for (const version of [6, 7, 8]) {
    const provider = CMS_MIGRATIONS.find(candidate => candidate.version === version);
    if (!provider) throw new Error(`The actual public canonical${version} provider is missing`);
    await database.atomicBatch([...await provider.statements(database),
      sql`INSERT INTO _cms_migrations(version) VALUES (${sql.lit(version)})`.compile(database.db)]);
  }
}
