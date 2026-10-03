import { Kysely as NativeKysely, OperationNodeTransformer, type KyselyConfig, type KyselyPlugin, type PluginTransformQueryArgs, type PluginTransformResultArgs, type QueryResult, type UnknownRow, type IdentifierNode, type RawNode, type DatabaseIntrospector } from 'kysely';
export * from 'kysely';

/** Logical Source namespace on real native tables, solely for whole-test hosting. */
class SourceNamespace extends OperationNodeTransformer {
  protected override transformIdentifier(node: IdentifierNode): IdentifierNode {
    return { ...node, name: node.name.replaceAll('_emdash_', '_cms_') };
  }
  protected override transformRaw(node: RawNode): RawNode {
    const result = super.transformRaw(node);
    return { ...result, sqlFragments: result.sqlFragments.map(value => value.replaceAll('_emdash_', '_cms_')) };
  }
}
const transformer = new SourceNamespace();
const sourceNamespace: KyselyPlugin = {
  transformQuery(value: PluginTransformQueryArgs) { return transformer.transformNode(value.node); },
  async transformResult(value: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> { return value.result; }
};

export class Kysely<DB> extends NativeKysely<DB> {
  constructor(config: KyselyConfig) {
    const log = config.log;
    super({ ...config, plugins: [...(config.plugins ?? []), sourceNamespace],
      log: typeof log === 'function' ? event => log(event.level === 'query'
        ? { ...event, query: { ...event.query, sql: event.query.sql.replaceAll('_cms_', '_emdash_') } }
        : event) : log });
  }
  override get introspection(): DatabaseIntrospector {
    const real = super.introspection;
    return {
      getSchemas: () => real.getSchemas(),
      getTables: async options => (await real.getTables(options)).map(table => ({ ...table, name: table.name.replaceAll('_cms_', '_emdash_') }))
    };
  }
}
