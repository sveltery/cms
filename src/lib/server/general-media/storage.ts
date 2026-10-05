import { OperationNodeTransformer, type Kysely, type KyselyPlugin, type TableNode } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from './upstream/database/types.ts';
import { registerBlockDatabaseHost } from '../blocks/upstream/host.ts';
import { withCanonicalFeatureNamespaces } from '../database/canonical-features/namespaces.ts';
const logicalTables:Readonly<Record<string,string>> = {
  media:'_cms_media', media_folders:'_cms_media_folders',
  _emdash_media_upload_attempts:'_cms_media_upload_attempts',
  _emdash_fields:'_cms_fields'
};
class MediaTables extends OperationNodeTransformer {
  protected override transformTable(node:TableNode):TableNode {
    const value=super.transformTable(node);
    if(value.table.schema)return value;
    const name=logicalTables[value.table.identifier.name];
    return name ? {...value,table:{...value.table,identifier:{...value.table.identifier,name}}} : value;
  }
}
const transformer=new MediaTables();
const namespace:KyselyPlugin={transformQuery:({node})=>transformer.transformNode(node),transformResult:async({result})=>result};
const handles=new WeakMap<object,Kysely<Database>>();
/** Fixed canonical table identifiers on the actual trusted database executor. */
export function generalMediaDatabase(database:CmsDatabase):Kysely<Database> {
  let db=handles.get(database.db);
  if(!db){
    db=withCanonicalFeatureNamespaces(database.db).withPlugin(namespace) as unknown as Kysely<Database>;handles.set(database.db,db);
    registerBlockDatabaseHost({...database,db:db as unknown as CmsDatabase['db']});
  }
  return db;
}
