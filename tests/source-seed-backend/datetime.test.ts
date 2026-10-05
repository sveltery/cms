import { expect, it } from 'vitest';
import { sql, OperationNodeTransformer, type KyselyPlugin, type TableNode } from 'kysely';
import { ContentDatetimeNormalizer } from 'seed-datetime-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { canonicalSourceDatabase } from '../../src/lib/server/canonical-storage/namespace.ts';

// Original integration tests, with zero copied Source case credit.
// The test-only logical namespace maps actual Native metadata; no providers are faked.
class FieldNamespace extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    const names: Record<string, string> = { _emdash_fields: '_cms_fields', _emdash_collections: '_cms_collections' };
    const name = names[transformed.table.identifier.name];
    return name ? { ...transformed, table: { ...transformed.table,
      identifier: { ...transformed.table.identifier, name } } } : transformed;
  }
}

for (const target of ['Node', 'D1'] as const) it(`${target}: uses persisted timezone and observes real Source field reads across a shared context`, async () => {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    const registry = new SchemaRegistry(storage.database);
    await registry.createCollection({ slug: 'appointments', label: 'Appointments' });
    await registry.createField('appointments', { slug: 'starts', label: 'Starts', type: 'datetime' });
    await storage.database.db.insertInto('_cms_options').values({ name: 'site:timezone', value: JSON.stringify('Asia/Tokyo') }).execute();
    const queries: string[] = [];
    const observed = new WeakMap<object, string>();
    const recorder: KyselyPlugin = {
      transformQuery(args) {
        // Observe original logical identifiers before the test namespace maps execution.
        observed.set(args.queryId, storage.database.db.getExecutor().compileQuery(args.node, args.queryId).sql);
        return args.node;
      }, async transformResult({ queryId, result }) { queries.push(observed.get(queryId)!); return result; }
    };
    const mapper = new FieldNamespace();
    const namespace: KyselyPlugin = { transformQuery: ({ node }) => mapper.transformNode(node),
      transformResult: async ({ result }) => result };
    const db = canonicalSourceDatabase({ ...storage.database,
      db: storage.database.db.withPlugin(recorder).withPlugin(namespace) });
    const normalizer = new ContentDatetimeNormalizer(db as any, new Map());
    for (let index = 0; index < 10; index++) {
      expect(await normalizer.normalizeData('appointments', { starts: '2026-03-01T09:00' })).toEqual({ starts: '2026-03-01T00:00:00.000Z' });
    }
    expect(queries.filter(query => query.includes('from "options"'))).toHaveLength(1);
    expect(queries.filter(query => query.includes('from "_emdash_fields"'))).toHaveLength(1);
    const result = await sql<{ value: string }>`SELECT value FROM _cms_options WHERE name='site:timezone'`.execute(storage.database.db);
    expect(JSON.parse(result.rows[0].value)).toBe('Asia/Tokyo');
    await storage.database.db.updateTable('_cms_options').set({ value: JSON.stringify('America/New_York') }).where('name', '=', 'site:timezone').execute();
    const next = new ContentDatetimeNormalizer(db as any, new Map());
    expect(await next.normalizeData('appointments', { starts: '2026-03-01T09:00' })).toEqual({ starts: '2026-03-01T14:00:00.000Z' });
    expect(queries.filter(query => query.includes('from "options"'))).toHaveLength(2);
    expect(queries.filter(query => query.includes('from "_emdash_fields"'))).toHaveLength(2);
  } finally { await storage.close(); }
}, 30000);
