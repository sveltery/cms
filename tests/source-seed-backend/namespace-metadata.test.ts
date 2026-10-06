import { expect, it } from 'vitest';
import { sql, type Kysely, type KyselyPlugin } from 'kysely';
import { seedSourceDatabase, seedAtomicBatch } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { ContentDatetimeNormalizer } from '../../src/lib/server/seed/upstream/database/content-datetime.ts';

// Additional complete original ordinary Native cases, with zero Source-case credit.
async function fixture(target: 'Node' | 'D1') {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    await new SchemaRegistry(storage.database).createSeedCollectionSchema({ slug: 'appointments', label: 'Appointments' },
      Array.from({ length: 74 }, (_, index) => ({ slug: `field_${index}`, label: `Field ${index}`, type: index === 73 ? 'datetime' : 'string' })));
    await storage.database.db.insertInto('_cms_options').values({ name: 'site:timezone', value: JSON.stringify('Asia/Tokyo') }).execute();
    return storage;
  } catch (cause) { await storage.close(); throw cause; }
}
for (const target of ['Node', 'D1'] as const) {
  it(`${target}: reads all 74 real field definitions and persists datetime context across derived views`, async () => {
    const storage = await fixture(target);
    try {
      const queries: string[] = [];
      const recorder: KyselyPlugin = { transformQuery(args) {
        queries.push(storage.database.db.getExecutor().compileQuery(args.node, args.queryId).sql);
        return args.node;
      }, transformResult: async ({ result }) => result };
      const db = seedSourceDatabase(storage.database).withPlugin(recorder) as Kysely<any>;
      const fields = db.selectFrom('_emdash_fields as f').select(['f.slug', 'f.type']).orderBy('f.sort_order');
      expect(fields.compile().sql).toBe('select "f"."slug", "f"."type" from "_cms_fields" as "f" order by "f"."sort_order"');
      queries.length = 0;
      const rows = await fields.execute();
      expect(rows).toHaveLength(74);
      expect(rows.at(-1)).toEqual({ slug: 'field_73', type: 'datetime' });
      expect(queries.filter(query => query.includes('from "_emdash_fields"'))).toHaveLength(1);
      queries.length = 0;
      const normalizer = new ContentDatetimeNormalizer(db, new Map());
      for (let index = 0; index < 10; index++) {
        expect(await normalizer.normalizeData('appointments', { field_73: '2026-03-01T09:00' })).toEqual({ field_73: '2026-03-01T00:00:00.000Z' });
      }
      expect(queries.filter(query => query.includes('from "options"'))).toHaveLength(1);
      expect(queries.filter(query => query.includes('from "_emdash_fields"'))).toHaveLength(1);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: retains the real atomic host across withPlugin, withTables and withSchema views`, async () => {
    const storage = await fixture(target);
    try {
      const plugin: KyselyPlugin = { transformQuery: ({ node }) => node, transformResult: async ({ result }) => result };
      const db = seedSourceDatabase(storage.database);
      const views = [db, db.withPlugin(plugin), db.withPlugin(plugin).withTables<{ custom: { value: string } }>(), db.withSchema('main')];
      for (const view of views) {
        const owner = lifecycleDatabase(view);
        expect(owner).toBeDefined();
        expect(owner?.atomicBatch).toBe(storage.database.atomicBatch);
        expect(owner?.close).toBe(storage.database.close);
      }
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: maps compiled metadata writes once and rolls back a genuine middle-statement failure`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      // This actual compiled-value assertion fails before any missing-table execution on baseline.
      const read = db.selectFrom('_emdash_fields').select('label').where('slug', '=', 'field_0');
      expect(read.compile().sql).toBe('select "label" from "_cms_fields" where "slug" = ?');
      await seedAtomicBatch(storage.database, db, view => [
        view.updateTable('_emdash_fields').set({ label: 'Changed first' }).where('slug', '=', 'field_0'),
        view.updateTable('_emdash_fields').set({ label: 'Changed last' }).where('slug', '=', 'field_73')
      ]);
      const updated = await storage.database.db.selectFrom('_cms_fields').select(['slug', 'label']).where('slug', 'in', ['field_0', 'field_73']).orderBy('sort_order').execute();
      expect(updated).toEqual([{ slug: 'field_0', label: 'Changed first' }, { slug: 'field_73', label: 'Changed last' }]);
      const original = storage.database.atomicBatch.bind(storage.database);
      const failing: CmsDatabase = { ...storage.database, async atomicBatch(statements) {
        return original([statements[0], sql`INSERT INTO _cms_guards(token, pass) VALUES ('seed-namespace-real-failure', 0)`.compile(storage.database.db), ...statements.slice(1)]);
      } };
      const failedView = seedSourceDatabase(failing) as Kysely<any>;
      const failure = await seedAtomicBatch(failing, failedView, view => [
        view.updateTable('_emdash_fields').set({ label: 'Must roll back first' }).where('slug', '=', 'field_0'),
        view.updateTable('_emdash_fields').set({ label: 'Must roll back last' }).where('slug', '=', 'field_73')
      ]).then(() => null, error => error);
      expect(failure).not.toBeNull();
      expect(await storage.database.db.selectFrom('_cms_fields').select(['slug', 'label']).where('slug', 'in', ['field_0', 'field_73']).orderBy('sort_order').execute()).toEqual(updated);
    } finally { await storage.close(); }
  }, 30000);
}
