import { OperationNodeTransformer, type IdentifierNode, type RawNode, type Kysely, type KyselyPlugin, type ValueNode } from 'kysely';
import { up as migrateGuards } from '../../../src/lib/server/redirects/migrations/081_redirect_write_guards.ts';

class SourceFixtureNames extends OperationNodeTransformer {
 protected override transformValue(node:ValueNode):ValueNode {
  return node.value === '_cms_redirects' ? {...node,value:'_emdash_redirects'} : node;
 }
 protected override transformIdentifier(node:IdentifierNode):IdentifierNode {
  return {...node,name:node.name.replace(/^_cms_/, '_emdash_')};
 }
 protected override transformRaw(node:RawNode):RawNode {
  const transformed=super.transformRaw(node);
  return {...transformed,sqlFragments:transformed.sqlFragments.map(fragment=>fragment.replaceAll('_cms_','_emdash_'))};
 }
}
const names=new SourceFixtureNames();
const plugin:KyselyPlugin={transformQuery:args=>names.transformNode(args.node),transformResult:async args=>args.result};
export function up(db:Kysely<unknown>):Promise<void> {
 return migrateGuards(db.withPlugin(plugin));
}
