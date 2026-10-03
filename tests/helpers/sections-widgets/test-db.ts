// Explicit Source-shaped SQLite fixtures; zero canonical migration/startup credit.
import { describe } from 'vitest';
import { OperationNodeTransformer, type IdentifierNode, type RawNode, type Kysely, type KyselyPlugin } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
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
export function createDatabase(options: { url: string }): Kysely<SourceTables> {
  if (options.url !== ':memory:') throw new Error('This explicit Source fixture only supports in-memory Node SQLite');
  return openSqlite(':memory:').db.withTables<SourceTables>().withPlugin(plugin) as unknown as Kysely<SourceTables>;
}
export async function runMigrations(db: Kysely<unknown>): Promise<void> {
  await widgets(db); await sections(db); await removeCategories(db);
}
export async function setupForDialect(dialect: 'sqlite'): Promise<DialectTestContext> {
  const db = createDatabase({ url: ':memory:' });
  await runMigrations(db as unknown as Kysely<unknown>);
  return { db, dialect };
}
export async function setupTestDatabase(): Promise<Kysely<SourceTables>> { return (await setupForDialect('sqlite')).db; }
export async function teardownTestDatabase(db: Kysely<SourceTables> | undefined): Promise<void> { await db?.destroy(); }
export async function teardownForDialect(context: DialectTestContext | undefined): Promise<void> { await context?.db.destroy(); }
export async function destroySharedPool(): Promise<void> { /* No PostgreSQL pool is installed by this fixture. */ }
export function describeEachDialect(name: string, callback: (dialect: 'sqlite') => void): void { describe(`${name} [native Node SQLite, original Source namespace]`, () => callback('sqlite')); }
