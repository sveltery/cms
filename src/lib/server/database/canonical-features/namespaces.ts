import { OperationNodeTransformer, type Kysely, type KyselyPlugin, type TableNode } from 'kysely';

/** Native hosts map only these known Source table nodes to canonical storage. */
class CanonicalFeatureTables extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    if (transformed.table.schema) return transformed;
    const name = transformed.table.identifier.name;
    const physical = name === 'options' ? '_cms_options' : name === 'taxonomies' ? '_cms_taxonomies' : name;
    return physical === name ? transformed : { ...transformed, table: { ...transformed.table,
      identifier: { ...transformed.table.identifier, name: physical } } };
  }
}
const transformer = new CanonicalFeatureTables();
const plugin: KyselyPlugin = {
  transformQuery({ node }) { return transformer.transformNode(node); },
  async transformResult({ result }) { return result; }
};

/**
 * No query/DDL, raw-string rewrite, column/literal rewrite or result substitution.
 * Whole Source implementations and explicitly logical Source fixtures retain
 * their namespaces; only the ordinary native request/loader hosts apply this.
 */
export function withCanonicalFeatureNamespaces<Database>(database: Kysely<Database>): Kysely<Database> {
  return database.withPlugin(plugin);
}
