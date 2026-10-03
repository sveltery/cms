// Test-only namespace boundary; complete Source fixture SQL retains _emdash_* identifiers.
import { OperationNodeTransformer, type IdentifierNode, type RawNode, type KyselyPlugin } from 'kysely';
class Namespace extends OperationNodeTransformer {
  protected override transformIdentifier(node: IdentifierNode): IdentifierNode {
    return { ...node, name: node.name.replace(/^_emdash_/, '_cms_') };
  }
  protected override transformRaw(node: RawNode): RawNode {
    const result = super.transformRaw(node);
    return { ...result, sqlFragments: result.sqlFragments.map(part => part.replaceAll('_emdash_', '_cms_')) };
  }
}
const transformer = new Namespace();
export const sourceNamespace: KyselyPlugin = {
  transformQuery(args) { return transformer.transformNode(args.node); },
  async transformResult(args) { return args.result; }
};
