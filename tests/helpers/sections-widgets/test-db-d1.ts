// Test-only runtime boundary for whole unchanged Source SQLite callbacks.
// Every query reaches a fresh actual Miniflare raw D1 binding. Explicit Source
// migration fixtures earn no canonical installation or startup credit.
import { describe } from 'vitest';
import { Miniflare } from 'miniflare';
import { Kysely, SqliteIntrospector, OperationNodeTransformer, type IdentifierNode, type RawNode, type KyselyPlugin, type SelectQueryNode, RawNode as RawQueryNode, WhereNode, AndNode, TableNode } from 'kysely';
import { RawBindingD1Dialect, type D1Binding, type D1Statement, type D1Result } from '../../../src/lib/server/database/d1.ts';
import { up as widgets } from '../../../parity/emdash/sections-widgets-source/upstream/packages/core/src/database/migrations/007_widgets.ts';
import { up as sections } from '../../../parity/emdash/sections-widgets-source/upstream/packages/core/src/database/migrations/011_sections.ts';
import { up as removeCategories } from '../../../parity/emdash/sections-widgets-source/upstream/packages/core/src/database/migrations/021_remove_section_categories.ts';

class SourceNames extends OperationNodeTransformer {
  protected override transformIdentifier(node: IdentifierNode): IdentifierNode { return { ...node, name: node.name.replace(/^_cms_/, '_emdash_') }; }
  protected override transformRaw(node: RawNode): RawNode {
    const result = super.transformRaw(node);
    return { ...result, sqlFragments: result.sqlFragments.map(part => part.replaceAll('_cms_', '_emdash_')) };
  }
}
const transformer = new SourceNames();
const plugin: KyselyPlugin = { transformQuery(args) { return transformer.transformNode(args.node); }, async transformResult(args) { return args.result; } };
type SourceTables = Record<string, Record<string, any>>;
export interface DialectTestContext { db: Kysely<SourceTables>; dialect: 'sqlite' }
const activeWorkers = new Set<Miniflare>();

// Cloudflare reserves _cf_ objects. The stock SQLite introspector otherwise
// requests their forbidden PRAGMA metadata when enumerating the user schema.
// Filter only its sqlite_master SELECT nodes; every returned row still comes
// from the actual raw D1 binding, and ordinary Source queries are untouched.
class UserMetadata extends OperationNodeTransformer {
  protected override transformSelectQuery(node: SelectQueryNode): SelectQueryNode {
    const result = super.transformSelectQuery(node);
    if (!result.from?.froms.some(from => TableNode.is(from) && from.table.identifier.name === 'sqlite_master')) return result;
    const allowed = RawQueryNode.createWithSql("lower(substr(name, 1, 4)) != '_cf_'");
    return { ...result, where: WhereNode.create(result.where ? AndNode.create(result.where.where, allowed) : allowed) };
  }
}
const metadata = new UserMetadata();
const userMetadata: KyselyPlugin = {
  transformQuery(args) { return metadata.transformNode(args.node); },
  async transformResult(args) { return args.result; }
};

export function createDatabase(options: { url: string }): Kysely<SourceTables> {
  if (options.url !== ':memory:') throw new Error('This explicit Source fixture only supports fresh local raw D1 storage');
  const worker = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("Source fixture"); } }',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { SOURCE_DB: 'sections-widgets-whole-source' } });
  activeWorkers.add(worker);
  const actual = worker.getD1Database('SOURCE_DB');
  const statements = new WeakMap<D1Statement, { sql: string; parameters: unknown[] }>();
  function statement(sql: string, parameters: unknown[] = []): D1Statement {
    const value: D1Statement = {
      bind(...next) { return statement(sql, next); },
      async all() { return await (await actual).prepare(sql).bind(...parameters).all() as unknown as D1Result; }
    };
    statements.set(value, { sql, parameters });
    return value;
  }
  const binding: D1Binding = {
    prepare: statement,
    async batch(values) {
      const database = await actual;
      const prepared = values.map(value => {
        const input = statements.get(value);
        if (!input) throw new Error('Statement does not belong to this actual Source fixture binding');
        return database.prepare(input.sql).bind(...input.parameters);
      });
      return await database.batch(prepared) as unknown as D1Result[];
    }
  };
  const raw = new RawBindingD1Dialect(binding);
  // The whole Source migration callbacks inspect real SQLite metadata. This
  // fixture introspector queries actual D1; production's bounded adapter keeps
  // its existing explicit unsupported-introspection contract unchanged.
  const db = new Kysely<SourceTables>({ dialect: {
    createAdapter: () => raw.createAdapter(), createDriver: () => raw.createDriver(),
    createQueryCompiler: () => raw.createQueryCompiler(), createIntrospector: database => new SqliteIntrospector(database.withPlugin(userMetadata))
  } }).withPlugin(plugin);
  const destroy = db.destroy.bind(db);
  db.destroy = async () => { try { await destroy(); } finally { await worker.dispose(); activeWorkers.delete(worker); } };
  return db;
}
export async function runMigrations(db: Kysely<unknown>): Promise<void> { await widgets(db); await sections(db); await removeCategories(db); }
export async function setupForDialect(dialect: 'sqlite'): Promise<DialectTestContext> {
  const db = createDatabase({ url: ':memory:' });
  await runMigrations(db as unknown as Kysely<unknown>);
  return { db, dialect };
}
export async function setupTestDatabase(): Promise<Kysely<SourceTables>> { return (await setupForDialect('sqlite')).db; }
export async function teardownTestDatabase(db: Kysely<SourceTables> | undefined): Promise<void> { await db?.destroy(); }
export async function teardownForDialect(context: DialectTestContext | undefined): Promise<void> { await context?.db.destroy(); }
export async function destroySharedPool(): Promise<void> { for (const worker of activeWorkers) { await worker.dispose(); activeWorkers.delete(worker); } }
export function describeEachDialect(name: string, callback: (dialect: 'sqlite') => void): void {
  describe(`${name} [actual raw D1, whole Source SQLite callbacks and namespace]`, () => callback('sqlite'));
}
