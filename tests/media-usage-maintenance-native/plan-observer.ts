import { writeFileSync } from 'node:fs';
import type { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs, RootOperationNode } from 'kysely';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

/** Review-only observer: compiles the actual transformed producer nodes and
 * records their actual ordered results. It owns no executor or write path. */
export function observeProducerPlans(owner:CmsDatabase) {
  const records:Array<{index:number;queryId:string;sql:string;parameters:readonly unknown[];result?:unknown}> = [];
  const ids = new WeakMap<object,number>();
  const compiler = owner.db.withoutPlugins().getExecutor();
  const plugin:KyselyPlugin = {
    transformQuery(args:PluginTransformQueryArgs):RootOperationNode {
      const compiled = compiler.compileQuery(args.node,args.queryId);
      ids.set(args.queryId,records.length);
      records.push({index:records.length,queryId:args.queryId.queryId,sql:compiled.sql,parameters:compiled.parameters});
      return args.node;
    },
    async transformResult(args:PluginTransformResultArgs) {
      const index=ids.get(args.queryId);
      if(index!==undefined) records[index].result=args.result;
      return args.result;
    },
  };
  return {
    owner:{...owner,db:owner.db.withPlugin(plugin)},
    save(name:string) {
      if(process.env.MEDIA_USAGE_NODE_PLAN_RECEIPTS!=='1') return;
      writeFileSync(`/tmp/media-usage-maintenance-node-plan-${name}.json`,
        JSON.stringify({actualProducerCompilation:true,actualResults:true,records},
          (_key,value)=>typeof value==='bigint'?value.toString():value,2)+'\n');
    },
  };
}
