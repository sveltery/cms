import { expect, it } from 'vitest';
import { sql } from 'kysely';
import { seedSourceDatabase } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { indexExists } from '../../src/lib/server/seed/upstream/database/dialect-helpers.ts';

// Existing Native control behavior. A catalog index name is not a table-name parameter.
for (const target of ['Node', 'D1'] as const) it(`${target}: preserves an index named options`, async () => {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    await sql`CREATE INDEX options ON _cms_options(name)`.execute(storage.database.db);
    expect(await indexExists(seedSourceDatabase(storage.database), 'options')).toBe(true);
  } finally { await storage.close(); }
}, 30000);
