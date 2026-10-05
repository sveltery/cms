import { OperationNodeTransformer, type Kysely, type KyselyPlugin, type TableNode } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from './database-types.ts';

export type BylineDatabaseInput = CmsDatabase | Kysely<Database>;
const owners = new WeakMap<object, CmsDatabase>();
const hosted = new WeakMap<object, Kysely<Database>>();
const tables: Readonly<Record<string,string>> = {
  _emdash_bylines: '_cms_bylines', _emdash_content_bylines: '_cms_content_bylines',
  _emdash_byline_fields: '_cms_byline_fields', _emdash_byline_field_values: '_cms_byline_field_values',
  _emdash_byline_field_group_values: '_cms_byline_field_group_values', media: '_cms_media', options: '_cms_options'
};
class BylineTables extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const value = super.transformTable(node);
    if (value.table.schema) return value;
    const physical = tables[value.table.identifier.name];
    return physical ? {...value, table:{...value.table,identifier:{...value.table.identifier,name:physical}}} : value;
  }
}
const transformer = new BylineTables();
const namespace: KyselyPlugin = {
  transformQuery({node}) { return transformer.transformNode(node); },
  async transformResult({result}) { return result; }
};

/** Register an actual native owner and its finite logical-table compilation host. */
export function registerBylineDatabase(database: CmsDatabase): Kysely<Database> {
  const prior = hosted.get(database.db);
  if (prior) { owners.set(prior,database); return prior; }
  const db = database.db.withPlugin(namespace) as unknown as Kysely<Database>;
  owners.set(database.db,database); owners.set(db,database); hosted.set(database.db,db); hosted.set(db,db);
  return db;
}

/**
 * Explicit reference-fixture transport. The owner must operate the genuine
 * Source namespace; no native installation calls this and no tables are added.
 */
export function registerBylineReferenceDatabase(database: CmsDatabase): Kysely<Database> {
  const db = database.db as unknown as Kysely<Database>;
  owners.set(db,database); hosted.set(db,db); return db;
}
export function bylineDatabase(input: BylineDatabaseInput): Kysely<Database> {
  if ('db' in input) return registerBylineDatabase(input);
  const prior = hosted.get(input);
  if (prior) return prior;
  // Read-only consumers may use the actual request's trusted Kysely handle.
  // A write additionally requires the registered canonical storage owner.
  const db = input.withPlugin(namespace); hosted.set(input,db); hosted.set(db,db);
  return db;
}
export function bylineDatabaseOwner(db: Kysely<Database>): CmsDatabase {
  const owner = owners.get(db);
  if (!owner) throw new Error('Byline writes require the actual registered CMS database owner');
  return owner;
}
