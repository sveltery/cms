import { describe } from 'vitest';
import { OperationNodeTransformer, type IdentifierNode, type RawNode, type Kysely, type KyselyPlugin, type PluginTransformQueryArgs, type PluginTransformResultArgs, type QueryResult, type UnknownRow } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import type { Database } from '../../../src/lib/server/redirects/database-types.ts';
import { installRedirectTables } from '../../../src/lib/server/redirects/migrations/index.ts';
import { waitForDeferredTasks } from '../../../src/lib/server/redirects/deferred-tasks.ts';

class Namespace extends OperationNodeTransformer {
  protected override transformIdentifier(node: IdentifierNode): IdentifierNode {
    return {...node,name:node.name.replace(/^_emdash_/, '_cms_')};
  }
  protected override transformRaw(node: RawNode): RawNode {
    const transformed = super.transformRaw(node);
    return {...transformed,sqlFragments:transformed.sqlFragments.map(fragment=>fragment.replaceAll('_emdash_','_cms_'))};
  }
}
const names=new Namespace();
const plugin: KyselyPlugin={
 transformQuery(args:PluginTransformQueryArgs){return names.transformNode(args.node);},
 async transformResult(args:PluginTransformResultArgs):Promise<QueryResult<UnknownRow>>{return args.result;}
};
const owned = new WeakMap<object,ReturnType<typeof openSqlite>>();
export interface DialectTestContext {db:Kysely<Database>;dialect:'sqlite'}
export async function createForDialect(_dialect:'sqlite'):Promise<DialectTestContext> {
 const storage=openSqlite(':memory:');
 const db=storage.db.withTables<{[Name in keyof Database]:Database[Name]}>().$pickTables<keyof Database>().withPlugin(plugin);
 owned.set(db,storage);
 return {db,dialect:'sqlite'};
}
export async function setupForDialect(dialect:'sqlite'):Promise<DialectTestContext> {
 const context=await createForDialect(dialect);
 await installRedirectTables(context.db as unknown as Kysely<unknown>);
 return context;
}
export function describeEachDialect(name:string,run:(dialect:'sqlite')=>void):void {
 describe(`${name} [native Node SQLite fixture]`,()=>run('sqlite'));
}
export async function setupTestDatabase():Promise<Kysely<Database>> {return (await setupForDialect('sqlite')).db;}
export async function teardownTestDatabase(db:Kysely<Database>|undefined):Promise<void> {
 await waitForDeferredTasks();
 if(db)await owned.get(db)?.close();
}
export async function teardownForDialect(context:DialectTestContext|undefined):Promise<void> {
 await teardownTestDatabase(context?.db);
}
