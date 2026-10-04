import { OperationNodeTransformer, type Kysely, type KyselyPlugin,
  type TableNode, type RawNode, type RootOperationNode, type OperationNode } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { RawBindingD1Adapter } from '../database/d1.ts';
import type { Database } from './types.ts';

const names: Readonly<Record<string, string>> = {
  options: '_cms_options', taxonomies: '_cms_taxonomies', content_taxonomies: '_cms_content_taxonomies',
  _emdash_taxonomy_defs: '_cms_taxonomy_defs', _emdash_taxonomy_def_groups: '_cms_taxonomy_def_groups'
};
// Retain literal bytes; map only whole SQL identifier tokens in Source raw SQL.
function nativeSql(value: string): string {
  return value.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*/g, token => {
    if (token.startsWith("'")) return token;
    const quoted = token.startsWith('"');
    const name = quoted ? token.slice(1, -1) : token;
    const mapped = names[name];
    return mapped ? quoted ? '"' + mapped + '"' : mapped : token;
  });
}
class NativeNamespace extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    const name = transformed.table.identifier.name;
    const mapped = names[name];
    return mapped ? { ...transformed, table: { ...transformed.table,
      identifier: { ...transformed.table.identifier, name: mapped } } } : transformed;
  }
  protected override transformRaw(node: RawNode): RawNode {
    const transformed = super.transformRaw(node);
    return { ...transformed, sqlFragments: transformed.sqlFragments.map(nativeSql) };
  }
}
const transformer = new NativeNamespace();
const namespace: KyselyPlugin = {
  transformQuery: ({ node }) => transformer.transformNode(node),
  transformResult: async ({ result }) => result
};


// Source taxonomy multiwrite methods have no native D1 atomic implementation.
// Keep them unavailable at the actual adapter seam; options remain single-query.
const unavailableD1Write = 'D1 taxonomy writes require atomic adaptation';
function tableName(node: OperationNode | undefined): string | undefined {
  return node?.kind === 'TableNode' ? (node as TableNode).table.identifier.name : undefined;
}
function optionMutation(node: RootOperationNode): boolean {
  let target: string | undefined;
  if (node.kind === 'InsertQueryNode' && !node.with) target = tableName(node.into);
  if (node.kind === 'UpdateQueryNode' && !node.with && !node.from && !node.joins) target = tableName(node.table);
  if (node.kind === 'DeleteQueryNode' && !node.with && !node.using && node.from.froms.length === 1) target = tableName(node.from.froms[0]);
  return target === 'options' || target === '_cms_options';
}
function rawCode(node: RawNode): string {
  return node.sqlFragments.join('?').replace(/--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]/g,' ');
}
const mutationSql = /;|\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|REINDEX|VACUUM|ATTACH|DETACH|PRAGMA)\b/i;
class D1SourceQueryBoundary extends OperationNodeTransformer {
  protected override transformRaw(node: RawNode): RawNode {
    if (mutationSql.test(rawCode(node))) throw new Error(unavailableD1Write);
    return super.transformRaw(node);
  }
  protected override transformNodeImpl<T extends OperationNode>(node: T): T {
    if (node.kind === 'InsertQueryNode' || node.kind === 'UpdateQueryNode' || node.kind === 'DeleteQueryNode') {
      if (!optionMutation(node as RootOperationNode)) throw new Error(unavailableD1Write);
    }
    if (node.kind === 'SelectQueryNode' && (node as Extract<RootOperationNode, {kind:'SelectQueryNode'}>).with) {
      throw new Error(unavailableD1Write);
    }
    return super.transformNodeImpl(node);
  }
}
const d1Boundary = new D1SourceQueryBoundary();
const d1SourceBoundary: KyselyPlugin = {
  transformQuery({node}) {
    const read = node.kind === 'SelectQueryNode' && !node.with || node.kind === 'RawNode' &&
      /^[ \t\r\n\f]*SELECT\b/i.test(rawCode(node));
    if (!read && !optionMutation(node)) throw new Error(unavailableD1Write);
    return d1Boundary.transformNode(node);
  },
  transformResult: async ({result}) => result
};

/** Whole Source repositories use logical names on the real canonical namespace. */
export function canonicalSourceDatabase(database: CmsDatabase): Kysely<Database> {
  const db = database.db.getExecutor().adapter instanceof RawBindingD1Adapter
    ? database.db.withPlugin(d1SourceBoundary) : database.db;
  return db.withPlugin(namespace) as unknown as Kysely<Database>;
}
