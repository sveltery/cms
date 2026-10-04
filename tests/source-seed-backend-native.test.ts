import { afterEach, describe, expect, it } from 'vitest';
import { sql, type CompiledQuery, type KyselyPlugin } from 'kysely';
import { Miniflare } from 'miniflare';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import type { CreateCollectionInput, CreateFieldInput } from '../src/lib/server/schema/types.ts';
import { editorManifest } from '../src/lib/server/content/manifest.ts';
import { schemaData, parse } from '../src/lib/server/database/validation.ts';
import { validateContentData } from '../src/lib/server/schema/validate-content.ts';

const fields: CreateFieldInput[] = Array.from({ length: 74 }, (_, index) => ({
  slug: `field_${index}`, label: `Field ${index}`, type: 'string', required: index === 73
}));
const admin = { id: 'seed-fixed-stored-admin', permissions: ['content:read', 'content:read_drafts'] as const };
const close: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of close.splice(0).reverse()) await cleanup(); });
async function fixture(target: 'Node' | 'raw D1') {
  const runtime = target === 'raw D1' ? new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("ordinary seed fixture"); } }',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { DB: 'source-seed-native-bulk' } }) : undefined;
  const database = runtime ? openD1(await runtime.getD1Database('DB')) : openSqlite(':memory:');
  close.push(async () => { await database.close(); await runtime?.dispose(); });
  await migrateCms(database);
  const queries: CompiledQuery[] = [];
  const compiled = new WeakMap<object, CompiledQuery>();
  const plugin: KyselyPlugin = {
    transformQuery(args) {
      compiled.set(args.queryId, database.db.getExecutor().compileQuery(args.node, args.queryId));
      return args.node;
    }, transformResult: async ({ queryId, result }) => { queries.push(compiled.get(queryId)!); return result; }
  };
  const observed: CmsDatabase = { ...database, db: database.db.withPlugin(plugin), async atomicBatch(statements) {
    // atomicBatch executes compiled statements directly, so account for them separately.
    queries.push(...statements);
    return database.atomicBatch(statements);
  } };
  return { database, observed, queries };
}

/** Baseline exercises actual public creation; this fallback earns no Source-test credit. */
async function createSeed(registry: SchemaRegistry, input: CreateCollectionInput, definitions: CreateFieldInput[]) {
  const bulk = registry as SchemaRegistry & { createSeedCollectionSchema?: (input: CreateCollectionInput, fields: CreateFieldInput[]) => Promise<void> };
  if (bulk.createSeedCollectionSchema) return bulk.createSeedCollectionSchema(input, definitions);
  await registry.createCollection({ ...input, source: 'seed' });
  for (const field of definitions) await registry.createField(input.slug, field);
}

for (const target of ['Node', 'raw D1'] as const) describe(target + ' actual native seed prerequisites', () => {
  it('creates all 74 fields with fewer than 50 queries and no statement over 100 bindings', async () => {
    const { observed, queries } = await fixture(target);
    const registry = new SchemaRegistry(observed);
    const error = await createSeed(registry, { slug: 'site_info', label: 'Site Info' }, fields).then(() => null, error => error);
    expect(error, 'public 32-field failure is the behavioral red').toBeNull();
    const creation = queries.slice();
    expect(creation.length).toBeLessThan(50);
    expect(Math.max(...creation.map(query => query.parameters.length))).toBeLessThanOrEqual(100);
    const collection = await registry.getCollectionWithFields('site_info');
    expect(collection?.source).toBe('seed');
    expect(collection?.fields).toHaveLength(74);
    const physical = await sql<{ name: string }>`PRAGMA table_info(ec_site_info)`.execute(observed.db);
    expect(physical.rows.map(row => row.name)).toContain('field_73');
  });

  it('reads every persisted field in registry, editor descriptors and content validation', async () => {
    const { database } = await fixture(target);
    const registry = new SchemaRegistry(database);
    const collection = await registry.createCollection({ slug: 'site_info', label: 'Site Info', source: 'seed' });
    // Independent actual DB fixture reaches read/validation expectations even before bulk exists.
    for (const field of fields) {
      await sql`ALTER TABLE ec_site_info ADD COLUMN ${sql.ref(field.slug)} TEXT`.execute(database.db);
      await database.db.insertInto('_cms_fields').values({ id: field.slug, collection_id: collection.id,
        slug: field.slug, label: field.label, type: 'string', column_type: 'TEXT', required: Number(field.required),
        unique: 0, default_value: null, validation: null, sort_order: Number(field.slug.slice(6)), created_at: collection.createdAt }).execute();
    }
    expect(await registry.listFields(collection.id)).toHaveLength(74);
    const manifest = await editorManifest(database, admin);
    expect(Object.keys(manifest.collections.site_info.fields)).toHaveLength(74);
    const data = Object.fromEntries(fields.map(field => [field.slug, field.label]));
    expect(() => parse(schemaData, data)).not.toThrow();
    expect((await validateContentData(database, 'site_info', data)).ok).toBe(true);
    expect((await validateContentData(database, 'site_info', { field_0: 'Missing last required field' })).ok).toBe(false);
  });

  it('rolls back metadata, all field chunks and DDL after an injected middle-statement failure', async () => {
    const { database } = await fixture(target);
    const original = database.atomicBatch.bind(database);
    const failing: CmsDatabase = { ...database, async atomicBatch(statements) {
      const inserts = statements.map((query, index) => /insert into "_cms_fields"/i.test(query.sql) ? index : -1).filter(index => index >= 0);
      if (inserts.length >= 2) {
        const index = inserts[1];
        const failure = sql`INSERT INTO _cms_guards(token, pass) VALUES ('seed-bulk-injected-failure', 0)`.compile(database.db);
        return original([...statements.slice(0, index), failure, ...statements.slice(index)]);
      }
      // Baseline sequential creation must not be mistaken for a rolled-back bulk implementation.
      if (inserts.length) return original([...statements, sql`INSERT INTO _cms_guards(token, pass) VALUES ('seed-bulk-injected-failure', 0)`.compile(database.db)]);
      return original(statements);
    } };
    const error = await createSeed(new SchemaRegistry(failing), { slug: 'rollback_seed', label: 'Rollback' }, fields).then(() => null, error => error);
    expect(error).not.toBeNull();
    expect(await new SchemaRegistry(database).getCollection('rollback_seed')).toBeNull();
    expect(await database.db.selectFrom('_cms_fields').selectAll().execute()).toEqual([]);
    expect((await sql`SELECT name FROM sqlite_master WHERE name = 'ec_rollback_seed'`.execute(database.db)).rows).toEqual([]);
  });

  it('allows ordinary field creation beyond the historical 32-field limit', async () => {
    const { database } = await fixture(target);
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'ordinary', label: 'Ordinary' });
    let error: unknown = null;
    for (const field of fields.slice(0, 34)) {
      try { await registry.createField('ordinary', field); } catch (cause) { error = cause; break; }
    }
    expect(error).toBeNull();
    expect((await registry.getCollectionWithFields('ordinary'))?.fields).toHaveLength(34);
  });
});
