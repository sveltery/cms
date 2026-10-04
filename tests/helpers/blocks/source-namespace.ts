import { OperationNodeTransformer, type KyselyPlugin, type TableNode } from 'kysely';
const physical: Record<string,string> = {
  _emdash_collections:'_cms_collections', _emdash_fields:'_cms_fields',
  _emdash_block_types:'_cms_block_types', _emdash_block_type_versions:'_cms_block_type_versions'
};
export class SourceBlockTables extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    const name = transformed.table.identifier.name;
    const mapped = transformed.table.schema === undefined ? physical[name] : undefined;
    return mapped ? {...transformed,table:{...transformed.table,identifier:{...transformed.table.identifier,name:mapped}}} : transformed;
  }
}
export const sourceBlockTables = new SourceBlockTables();
export const sourceBlockNamespace: KyselyPlugin = {
  transformQuery({node}) { return sourceBlockTables.transformNode(node); },
  async transformResult({result}) { return result; }
};
