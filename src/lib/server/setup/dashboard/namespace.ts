// Dashboard-only logical table adaptation; Source identifiers/values remain unchanged.
import { OperationNodeTransformer, type KyselyPlugin, type TableNode, type Kysely } from 'kysely';
import type { CmsDatabase } from '../../database/contract.ts';
import { canonicalSourceDatabase } from '../../canonical-storage/namespace.ts';
import { registerLifecycleDatabase } from '../../database/lifecycle/upstream/host.ts';
import type { Database } from './database-types.ts';

const names: Readonly<Record<string, string>> = {
  _emdash_collections: '_cms_collections', _emdash_fields: '_cms_fields',
  media: '_cms_media', users: '_cms_auth_users'
};
class DashboardNamespace extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    const mapped = names[transformed.table.identifier.name];
    return mapped ? { ...transformed, table: { ...transformed.table,
      identifier: { ...transformed.table.identifier, name: mapped } } } : transformed;
  }
}
const transformer = new DashboardNamespace();
const namespace: KyselyPlugin = {
  transformQuery: ({ node }) => transformer.transformNode(node),
  transformResult: async ({ result }) => result
};

/** Actual canonical adapter and lifecycle atomic host; no configured cache/timezone claim. */
export function dashboardSourceDatabase(storage: CmsDatabase): Kysely<Database> {
  const db = canonicalSourceDatabase(storage).withPlugin(namespace) as unknown as Kysely<Database>;
  registerLifecycleDatabase({ ...storage, db: db as unknown as CmsDatabase['db'] });
  return db;
}
