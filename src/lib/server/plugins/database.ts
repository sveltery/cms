import { OperationNodeTransformer, type Kysely, type KyselyPlugin, type TableNode } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from './database-types.ts';
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
  if (prior) { owners.set(prior, database); return prior; }
  const view = database.db.withPlugin(namespace) as unknown as Kysely<Database>;
  owners.set(database.db, database); owners.set(view, database); views.set(database.db, view); views.set(view, view);
  return view;
}
export function registeredPluginDatabaseOwner(db: object): CmsDatabase | undefined { return owners.get(db); }
export function pluginDatabaseOwner(db: object): CmsDatabase {
  const owner = registeredPluginDatabaseOwner(db);
  if (!owner) throw new Error('Plugin domain access requires the actual registered CMS database owner');
  return owner;
}
/** Private lifecycle transport: a transaction remains on its existing executor. */
export function registerPluginTransaction(db: object, owner: CmsDatabase): void { owners.set(db, owner); }
