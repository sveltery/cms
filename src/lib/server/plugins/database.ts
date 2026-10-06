import { OperationNodeTransformer, type Kysely, type KyselyPlugin, type TableNode } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from './database-types.ts';
import { lifecycleDatabase, registerLifecycleDatabase, inheritLifecycleDatabase } from '../database/lifecycle/upstream/host.ts';
const owners = new WeakMap<object, CmsDatabase>();
const views = new WeakMap<object, Kysely<Database>>();
const tables: Readonly<Record<string, string>> = {
  _plugin_state: '_cms_plugin_state', _plugin_storage: '_cms_plugin_storage', _plugin_indexes: '_cms_plugin_indexes',
  _emdash_cron_tasks: '_cms_cron_tasks', options: '_cms_options',
  _emdash_bylines: '_cms_bylines', _emdash_content_bylines: '_cms_content_bylines',
  _emdash_byline_fields: '_cms_byline_fields', _emdash_byline_field_values: '_cms_byline_field_values',
  _emdash_byline_field_group_values: '_cms_byline_field_group_values'
};
class PluginTables extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    if (transformed.table.schema) return transformed;
    const name = tables[transformed.table.identifier.name];
    return name ? { ...transformed, table: { ...transformed.table, identifier: { ...transformed.table.identifier, name } } } : transformed;
  }
}
const transformer = new PluginTables();
const namespace: KyselyPlugin = {
  transformQuery({ node }) { return transformer.transformNode(node); },
  async transformResult({ result }) { return result; }
};
/** A finite identifier view of the actual current CMS owner, with all existing plugins retained. */
export function pluginSourceDatabase(database: CmsDatabase): Kysely<Database> {
  const prior = views.get(database.db);
  if (prior) {
    owners.set(prior, database);
    inheritLifecycleDatabase({ db: prior as unknown as CmsDatabase['db'], atomicQueryLoops: database.atomicQueryLoops,
      atomicBatch: statements => database.atomicBatch(statements),
      async close() { throw new Error('A plugin view does not own the database connection'); }
    }, database.db);
    return prior;
  }
  const view = database.db.withPlugin(namespace) as unknown as Kysely<Database>;
  owners.set(database.db, database); owners.set(view, database); views.set(database.db, view); views.set(view, view);
  if (!lifecycleDatabase(database.db)) registerLifecycleDatabase(database);
  inheritLifecycleDatabase({
    db: view as unknown as CmsDatabase['db'], atomicQueryLoops: database.atomicQueryLoops,
    atomicBatch: statements => database.atomicBatch(statements),
    async close() { throw new Error('A plugin view does not own the database connection'); }
  }, database.db);
  return view;
}
export function registeredPluginDatabaseOwner(db: object): CmsDatabase | undefined { return owners.get(db); }
/** Namespace views may only write through their registered current owner. */
export function assertRegisteredPluginNamespace(db: Kysely<any>): void {
  if (db.getExecutor().plugins.includes(namespace) && !owners.has(db)) {
    throw new Error('Plugin domain access requires the actual registered CMS database owner');
  }
}
export function pluginDatabaseOwner(db: object): CmsDatabase {
  const owner = registeredPluginDatabaseOwner(db);
  if (!owner) throw new Error('Plugin domain access requires the actual registered CMS database owner');
  return owner;
}
/** Private lifecycle transport: a transaction remains on its existing executor. */
export async function executePluginTransaction<DB, T>(db: Kysely<DB>, run: (trx: Kysely<DB>) => Promise<T>): Promise<T> {
  assertRegisteredPluginNamespace(db);
  const owner = pluginDatabaseOwner(db);
  if (db.isTransaction) return run(db);
  if (!owner.atomicQueryLoops) throw new Error('D1 plugin compound writes require the named canonical atomic batch producer');
  return db.transaction().execute(async trx => {
    const transactionOwner: CmsDatabase = {
      db: trx as unknown as CmsDatabase['db'], atomicQueryLoops: owner.atomicQueryLoops,
      async atomicBatch(statements) {
        const results = [];
        for (const statement of statements) results.push(await trx.executeQuery(statement));
        return results;
      },
      async close() { throw new Error('A transaction does not own the database connection'); }
    };
    owners.set(trx, transactionOwner);
    inheritLifecycleDatabase(transactionOwner, db);
    return run(trx);
  });
}
