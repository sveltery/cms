// Native Node statement-cost controls; Original Source files/clocks stay exact.
import { expect, it } from 'vitest';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { seedSourceDatabase } from '../../src/lib/server/seed/namespace.ts';
import { TaxonomyRepository, RelationRepository } from '../../src/lib/server/seed/providers.ts';
import { TaxonomyRepository as CanonicalTaxonomy } from '../../src/lib/server/taxonomies/repository.ts';
import { RelationRepository as CanonicalRelation } from '../../src/lib/server/relations/repository.ts';

it('Node: retains real taxonomy compiler query and receipt observers with original class identity', async () => {
  const storage = await schemaAdminStorage('Node');
  try {
    await migrateCms(storage.database);
    const queries: { kind: string; id: unknown }[] = [], results: unknown[] = [];
    const db = seedSourceDatabase(storage.database).withPlugin({
      transformQuery({ node, queryId }) { queries.push({ kind: node.kind, id: queryId }); return node; },
      async transformResult({ result, queryId }) { results.push(queryId); return result; },
    });
    expect(TaxonomyRepository).toBe(CanonicalTaxonomy);
    const term = await new TaxonomyRepository(db).create({ name: 'tag', slug: 'actual-observed', label: 'Actual observed' });
    expect((await sql`SELECT id FROM _cms_taxonomies WHERE id=${term.id}`.execute(storage.database.db)).rows).toEqual([{ id: term.id }]);
    expect(queries.filter(query => query.kind === 'InsertQueryNode')).toHaveLength(1);
    expect(results).toEqual(queries.map(query => query.id));
  } finally { await storage.close(); }
}, 30000);

it('Node: retains real relation queries and receipts with original class identity', async () => {
  const storage = await schemaAdminStorage('Node');
  try {
    await migrateCms(storage.database);
    const queries: { kind: string; id: unknown }[] = [], results: unknown[] = [];
    const db = seedSourceDatabase(storage.database).withPlugin({
      transformQuery({ node, queryId }) { queries.push({ kind: node.kind, id: queryId }); return node; },
      async transformResult({ result, queryId }) { results.push(queryId); return result; },
    });
    expect(RelationRepository).toBe(CanonicalRelation);
    const relation = await new RelationRepository(db).create({ slug: 'actual_observed', parentCollection: 'posts', childCollection: 'pages', parentLabel: 'Posts', childLabel: 'Pages' });
    expect((await sql`SELECT id FROM _cms_relations WHERE id=${relation.id}`.execute(storage.database.db)).rows).toEqual([{ id: relation.id }]);
    expect(queries.filter(query => query.kind === 'InsertQueryNode')).toHaveLength(1);
    expect(results).toEqual(queries.map(query => query.id));
  } finally { await storage.close(); }
}, 30000);

for (const kind of ['taxonomy', 'relation'] as const) {
  it(`Node: observes ${kind} writes once inside a genuine Source callback transaction`, async () => {
    const storage = await schemaAdminStorage('Node');
    try {
      await migrateCms(storage.database);
      const queries: unknown[] = [], results: unknown[] = [], order: string[] = [];
      const db = seedSourceDatabase(storage.database).withPlugin({
        transformQuery({ node, queryId }) { queries.push(queryId); order.push('query:first'); return node; },
        async transformResult({ result, queryId }) { results.push(queryId); order.push('result:first'); return result; },
      }).withPlugin({
        transformQuery({ node }) { order.push('query:second'); return node; },
        async transformResult({ result }) { order.push('result:second'); return result; },
      });
      const id = await db.transaction().execute(async transaction => {
        if (kind === 'taxonomy') return (await new TaxonomyRepository(transaction).create({ name: 'tag', slug: 'transaction-observed', label: 'Transaction observed' })).id;
        return (await new RelationRepository(transaction).create({ slug: 'transaction_observed', parentCollection: 'posts', childCollection: 'pages', parentLabel: 'Posts', childLabel: 'Pages' })).id;
      });
      const actual = kind === 'taxonomy'
        ? await sql`SELECT id FROM _cms_taxonomies WHERE id=${id}`.execute(storage.database.db)
        : await sql`SELECT id FROM _cms_relations WHERE id=${id}`.execute(storage.database.db);
      expect(actual.rows).toEqual([{ id }]);
      expect(queries.length).toBeGreaterThan(1);
      expect(new Set(queries).size).toBe(queries.length);
      expect(results).toEqual(queries);
      for (let index = 0; index < order.length; index += 2) {
        expect(order[index + 1]).toBe(order[index].replace(':first', ':second'));
      }
    } finally { await storage.close(); }
  }, 30000);
}
