import { OperationNodeTransformer, type Kysely, type KyselyPlugin,
  type TableNode, type RawNode } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
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

/** Whole Source repositories use logical names on the real canonical namespace. */
export function canonicalSourceDatabase(database: CmsDatabase): Kysely<Database> {
  return database.db.withPlugin(namespace) as unknown as Kysely<Database>;
}
