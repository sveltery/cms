import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { requireRelationDatabase } from '../../../src/lib/server/relations/storage.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { deleteRelationsForCollection } from '../../../src/lib/server/relations/deletion.ts';
import { tableName } from '../../../src/lib/server/database/validation.ts';
import type { ApiResult } from '../../../src/lib/server/menus/api-types.ts';

// Source constructor/envelope bridge to actual persisted native producers.
// Full production schema transport remains the schema owner's unfinished scope.
export async function handleSchemaCollectionDelete(db:Kysely<any>,slug:string,options?:{force?:boolean}):Promise<ApiResult<{success:boolean}>>{
  const database=requireRelationDatabase(db),registry=new SchemaRegistry(database);
  const collection=await registry.getCollection(slug);
  if(!collection)return {success:false,error:{code:'COLLECTION_NOT_FOUND',message:'Collection not found'}};
  if(!options?.force){
    const content=await sql<{count:number}>`SELECT COUNT(*) AS count FROM ${sql.ref(tableName(slug))} WHERE deleted_at IS NULL`.execute(database.db);
    if(Number(content.rows[0].count)>0)return {success:false,error:{code:'COLLECTION_HAS_CONTENT',message:'Collection has content'}};
  }
  const removed=await deleteRelationsForCollection(database,slug);if(!removed.success)return removed;
  await registry.deleteCollection(slug,options);return {success:true,data:{success:true}};
}
