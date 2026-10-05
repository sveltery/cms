import { InsertResult, UpdateResult, DeleteResult, NoResultError, type CompiledQuery, type Kysely, type QueryResult, type UnknownRow } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import type { Database } from '../../../src/lib/server/seed/upstream/database/types.ts';
import { seedDomainPlanCompiler } from '../../../src/lib/server/seed/namespace.ts';
import { registerBylineDatabaseHandle } from '../../../src/lib/server/bylines/storage.ts';
import { registerBlockDatabaseHost } from '../../../src/lib/server/blocks/upstream/host.ts';

const guardedHandles = new WeakMap<object, Kysely<Database>>();
export function fixtureProductionHandle(db: Kysely<Database>): Kysely<Database> {
  return guardedHandles.get(db) ?? db;
}
export function originalFixtureGuardedHandle(db: Kysely<Database>): Kysely<Database> {
  const guarded = guardedHandles.get(db);
  if (!guarded) throw new Error('Original D1 fixture requires its actual registered guarded handle');
  return guarded;
}

/** Root-qualified isolated Original fixture transport. Compile exact Source SQL,
 * execute on the same real owner, then run those actual plugins with queryId.
 * This never changes the production D1 query boundary or transaction behavior. */
export function originalD1FixtureHandle(guarded: Kysely<Database>, owner: CmsDatabase): Kysely<Database> {
  const compiler = seedDomainPlanCompiler(guarded);
  const executor = compiler.getExecutor();
  async function execute(query: CompiledQuery, options?: Parameters<typeof owner.db.executeQuery>[1]): Promise<QueryResult<unknown>> {
    let result = await owner.db.executeQuery<UnknownRow>(query, options);
    for (const plugin of executor.plugins) result = await plugin.transformResult({ result, queryId: query.queryId });
    return result;
  }
  function builder(target: any): any {
    return new Proxy(target, { get(instance, key) {
      if (key === 'getExecutor') return () => new Proxy(executor, { get(current, member) {
        if (member === 'executeQuery') return execute;
        const value = Reflect.get(current, member, current);
        return typeof value === 'function' ? value.bind(current) : value;
      } });
      if (key === 'transaction') return () => guarded.transaction();
      if (key === 'withPlugin') return (plugin: Parameters<typeof guarded.withPlugin>[0]) => originalD1FixtureHandle(guarded.withPlugin(plugin), owner);
      if (key === 'withoutPlugins') return () => { throw new Error('Original fixture plugins cannot be removed'); };
      if (key === 'execute' || key === 'executeTakeFirst' || key === 'executeTakeFirstOrThrow') return async () => {
        const query: CompiledQuery = instance.compile();
        const result = await execute(query);
        let rows: readonly unknown[] = result.rows;
        const node = query.query;
        if (node.kind === 'InsertQueryNode' && !node.returning) rows = [new InsertResult(result.insertId, result.numAffectedRows)];
        if (node.kind === 'UpdateQueryNode' && !node.returning) rows = [new UpdateResult(result.numAffectedRows ?? 0n,result.numChangedRows)];
        if (node.kind === 'DeleteQueryNode' && !node.returning) rows = [new DeleteResult(result.numAffectedRows ?? 0n)];
        if (key === 'execute') return rows;
        if (key === 'executeTakeFirstOrThrow' && rows.length === 0) throw new NoResultError(query.query as ConstructorParameters<typeof NoResultError>[0]);
        return rows[0];
      };
      const value = Reflect.get(instance, key, instance);
      if (typeof value === 'function') return (...args: unknown[]) => {
        const result = value.apply(instance, args);
        return result && typeof result === 'object' && ('compile' in result || 'getExecutor' in result) ? builder(result) : result;
      };
      return value && typeof value === 'object' && key === 'schema' ? builder(value) : value;
    } });
  }
  const fixture = builder(compiler) as Kysely<Database>;
  guardedHandles.set(fixture, guarded);
  registerBylineDatabaseHandle(owner, fixture as unknown as Parameters<typeof registerBylineDatabaseHandle>[1]);
  registerBlockDatabaseHost({...owner,db:fixture as unknown as CmsDatabase['db']});
  return fixture;
}
