import { describe } from 'vitest';
import { Kysely, SqliteDialect, OperationNodeTransformer, type TableNode, type ColumnNode, type KyselyPlugin } from 'kysely';
import { openNodeSqliteDatabase } from '../../../src/lib/server/database/node-sqlite-compat.ts';
import type { Database } from '../../../src/lib/server/database/lifecycle/upstream/database/types.ts';
import { up as relations } from '../../../parity/emdash/relations-source/executable/packages/core/src/database/migrations/043_content_references.ts';
import { up as structural } from '../../../parity/emdash/relations-source/executable/packages/core/src/database/migrations/086_relations_structural.ts';

// Actual whole Source043/086 DDL. This is a reference namespace host only;
// no native canonical installation, PostgreSQL or workerd credit follows.
const tableMap = new Map([['_cms_relations', '_emdash_relations'], ['_cms_content_references', '_emdash_content_references']]);
class LogicalRelationNames extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const result = super.transformTable(node);
    const name = result.table.identifier.name;
    const target = !result.table.schema && tableMap.get(name);
    return target ? { ...result, table: { ...result.table, identifier: { ...result.table.identifier, name: target } } } : result;
  }
  protected override transformColumn(node: ColumnNode): ColumnNode {
    const result = super.transformColumn(node);
    const target = tableMap.get(result.column.name);
    return target ? { ...result, column: { ...result.column, name: target } } : result;
  }
}
const transformer = new LogicalRelationNames();
export const relationReferencePlugin: KyselyPlugin = { transformQuery({ node }) { return transformer.transformNode(node); }, async transformResult({ result }) { return result; } };
export function withRelationReferenceNamespace(db: Kysely<Database>): Kysely<Database> { return db.withPlugin(relationReferencePlugin); }
export async function runMigrations(db: Kysely<Database>): Promise<void> {
  await relations(db as unknown as Kysely<unknown>);
  await structural(db as unknown as Kysely<unknown>);
}
export interface DialectTestContext { db: Kysely<Database>; dialect: 'sqlite' | 'postgres' }
export async function setupForDialect(dialect: 'sqlite' | 'postgres'): Promise<DialectTestContext> {
  if (dialect !== 'sqlite') throw new Error('Original PostgreSQL context is unconfigured in this reference host');
  const db = withRelationReferenceNamespace(new Kysely<Database>({ dialect: new SqliteDialect({ database: openNodeSqliteDatabase(':memory:') }) }));
  await runMigrations(db);
  return { db, dialect };
}
export async function teardownForDialect(ctx: DialectTestContext | undefined) { await ctx?.db.destroy(); }
export const hasPgTestDatabase = (process.env.EMDASH_TEST_PG ?? '').length > 0;
export function describeEachDialect(name: string, fn: (dialect: 'sqlite' | 'postgres') => void) {
  const dialects: ('sqlite' | 'postgres')[] = ['sqlite'];
  if (hasPgTestDatabase) dialects.push('postgres');
  for (const dialect of dialects) describe(`${name} [${dialect}]`, () => fn(dialect));
}
