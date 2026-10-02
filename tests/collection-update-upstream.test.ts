// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import test from 'node:test';
import { CmsError } from '../src/lib/server/database/contract.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { collectionUpdateCases } from './helpers/collection-update-contract.ts';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';

for (const target of ['Node', 'D1'] as const) for (const source of collectionUpdateCases) {
  test(`${target}: registry.test.ts:${source.line}: ${source.title}`, { timeout: 30000 }, async () => {
    const storage = await collectionUpdateStorage(target);
    try {
      await migrateCms(storage.database);
      const registry = new SchemaRegistry(storage.database);
      await source.run({ seed: input => registry.createCollection(input),
        update: (slug, input) => registry.updateCollection(slug, input), error: CmsError,
        async backdate(slug) {
          await storage.database.db.updateTable('_cms_collections')
            .set({ updated_at: '2000-01-01T00:00:00.000Z' }).where('slug', '=', slug).execute();
        }
      });
    } finally { await storage.close(); }
  });
}
