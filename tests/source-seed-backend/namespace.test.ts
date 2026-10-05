import { expect, it } from 'vitest';
import { sql, type Kysely, type KyselyPlugin } from 'kysely';
import { seedSourceDatabase } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { tableExists, columnExists, listTableColumns } from '../../src/lib/server/seed/upstream/database/dialect-helpers.ts';

// Entirely original ordinary Native cases. No Source-family, provider or auth/session credit.
async function fixture(target: 'Node' | 'D1') {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    await storage.database.db.insertInto('_cms_options').values({ name: 'site:title', value: JSON.stringify('options') }).execute();
    return { ...storage, source: seedSourceDatabase(storage.database) as Kysely<any> };
  } catch (cause) { await storage.close(); throw cause; }
}
function recorder(database: Kysely<any>, queries: string[]): KyselyPlugin {
  const observed = new WeakMap<object, string>();
  return {
    transformQuery(args) {
      observed.set(args.queryId, database.getExecutor().compileQuery(args.node, args.queryId).sql);
      return args.node;
    }, async transformResult({ queryId, result }) { queries.push(observed.get(queryId)!); return result; }
  };
}

for (const target of ['Node', 'D1'] as const) {
  it(`${target}: preserves positive logical query observations across two derived plugin views`, async () => {
    const storage = await fixture(target);
    try {
      const first: string[] = [], second: string[] = [];
      const view = storage.source.withPlugin(recorder(storage.database.db, first)).withPlugin(recorder(storage.database.db, second));
      const row = await view.selectFrom('options').select('value').where('name', '=', 'site:title').executeTakeFirstOrThrow();
      expect(JSON.parse(row.value)).toBe('options');
      expect(first.filter(query => query.includes('from "options"'))).toHaveLength(1);
      expect(second.filter(query => query.includes('from "options"'))).toHaveLength(1);
      expect(first).toEqual(second);
      expect(first).toHaveLength(1);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: maps only catalog table-name values and retains literal column names`, async () => {
    const storage = await fixture(target);
    try {
      const physical = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE name IN ('_cms_collections', '_cms_fields') ORDER BY name`.execute(storage.database.db);
      expect(physical.rows.map(row => row.name)).toEqual(['_cms_collections', '_cms_fields']);
      expect(await tableExists(storage.source, '_emdash_collections')).toBe(true);
      expect(await columnExists(storage.source, '_emdash_fields', 'slug')).toBe(true);
      const columns = await listTableColumns(storage.source, '_emdash_fields');
      expect(columns.some(column => column.name === 'collection_id')).toBe(true);
      expect(columns.length).toBeGreaterThan(10);
      const bound = await sql<{ value: string }>`SELECT ${'options'} AS value`.execute(storage.source);
      expect(bound.rows).toEqual([{ value: 'options' }]);
      expect(await columnExists(storage.source, '_emdash_fields', 'options')).toBe(true);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: retains a physical table alias and result alias named options`, async () => {
    const storage = await fixture(target);
    try {
      const query = storage.source.selectFrom('_cms_options as options').select('options.value as options').where('options.name', '=', 'site:title');
      expect(query.compile().sql).toBe('select "options"."value" as "options" from "_cms_options" as "options" where "options"."name" = ?');
      const rows = await query.execute();
      expect(rows).toEqual([{ options: JSON.stringify('options') }]);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: preserves raw aliases, comments, result columns and ordinary bound values`, async () => {
    const storage = await fixture(target);
    try {
      const query = sql<{ options: string; literal: string }>`SELECT options.value AS options, ${'options'} AS literal FROM _cms_options AS options WHERE options.name = ${'site:title'} /* options _emdash_fields are ordinary comment bytes */`;
      const compiled = query.compile(storage.source);
      expect(compiled.sql).toBe('SELECT options.value AS options, ? AS literal FROM _cms_options AS options WHERE options.name = ? /* options _emdash_fields are ordinary comment bytes */');
      expect(compiled.parameters).toEqual(['options', 'site:title']);
      const rows = await query.execute(storage.source);
      expect(rows.rows).toEqual([{ options: JSON.stringify('options'), literal: 'options' }]);
    } finally { await storage.close(); }
  }, 30000);
}
