import { OperationNodeTransformer, type IdentifierNode, type RawNode, type KyselyPlugin } from 'kysely';
/** Logical Source prefix maps to real native tables; all values remain bound. */
class CommentNamespace extends OperationNodeTransformer {
  protected override transformIdentifier(node: IdentifierNode): IdentifierNode {
    return { ...node, name: node.name.replace(/^_emdash_/, '_cms_') };
  }
  protected override transformRaw(node: RawNode): RawNode {
    const transformed = super.transformRaw(node);
    return { ...transformed, sqlFragments: transformed.sqlFragments.map(fragment => fragment.replaceAll('_emdash_', '_cms_')) };
  }
}
const namespace = new CommentNamespace();
export const commentNamespacePlugin: KyselyPlugin = {
  transformQuery: args => namespace.transformNode(args.node),
  transformResult: async args => args.result
};
