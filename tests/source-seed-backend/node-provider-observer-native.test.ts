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
