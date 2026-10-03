import {Kysely,SqliteQueryCompiler,SqliteIntrospector,type CompiledQuery,type DatabaseConnection,type Driver,type Dialect,type QueryResult} from 'kysely';
import type {CmsDatabase,Field} from '../database/contract.ts';
import type {Database} from '../database/lifecycle/upstream/database/types.ts';
import {FTSManager} from './fts-manager.ts';

export type SearchSchemaField = Pick<Field,'slug'|'type'|'searchable'>;
/** Compile the unchanged source manager into the same atomic batch as metadata
 * and DDL. Only its two metadata field reads see the projected schema. Every
 * other read uses real storage; captured writes execute solely in atomicBatch.
 * This is a statement planner, never an alternate database execution mode.
 */
export function searchStatementPlanner(database:CmsDatabase,collectionId:string,fields:readonly SearchSchemaField[]) {
  const statements:CompiledQuery[]=[];
  const fieldTypes='select "slug", "type" from "_cms_fields" where "collection_id" = ?';
  const searchable='select "slug" from "_cms_fields" where "collection_id" = ? and "searchable" = ?';
  const connection:DatabaseConnection={
    async executeQuery<R>(query:CompiledQuery):Promise<QueryResult<R>> {
      if(query.sql===fieldTypes || query.sql===searchable) {
        if(query.parameters[0]!==collectionId || (query.sql===searchable&&query.parameters[1]!==1)) throw new Error('Unexpected search schema projection');
        return {rows:(query.sql===fieldTypes?fields.map(field=>({slug:field.slug,type:field.type})):fields.filter(field=>field.searchable).map(field=>({slug:field.slug}))) as R[]};
      }
      if(/^\s*select\b/i.test(query.sql)) return database.db.executeQuery<R>(query);
      if(!/^\s*(?:create virtual table|create trigger|drop trigger|drop table|insert or replace into|update "_cms_collections")(?:\s|$)/i.test(query.sql)) throw new Error('Unsupported search planned statement');
      statements.push(query);return {rows:[]};
    },
    async *streamQuery():AsyncIterableIterator<QueryResult<never>> {throw new Error('Search plans do not stream');}
  };
  const driver:Driver={async init(){},async acquireConnection(){return connection;},async releaseConnection(){},async destroy(){},async beginTransaction(){throw new Error('Search plans require atomicBatch');},async commitTransaction(){throw new Error('Search plans require atomicBatch');},async rollbackTransaction(){throw new Error('Search plans require atomicBatch');}};
  const dialect:Dialect={createDriver:()=>driver,createAdapter:()=>database.db.getExecutor().adapter,createQueryCompiler:()=>new SqliteQueryCompiler(),createIntrospector:db=>new SqliteIntrospector(db)};
  const db=new Kysely<Database>({dialect});
  return {manager:new FTSManager(db),statements,close:()=>db.destroy()};
}

// Pinned registry.ts syncSearchState, with compilation replacing its callback
// transaction so the source's metadata/FTS rollback contract works on real D1.
export async function planSchemaSearch(database:CmsDatabase,slug:string,supports:readonly string[],fields:readonly SearchSchemaField[]):Promise<CompiledQuery[]> {
  const collection=await database.db.selectFrom('_cms_collections').selectAll().where('slug','=',slug).executeTakeFirst();
  if(!collection?.search_config) return [];
  const real=new FTSManager(database.db as unknown as Kysely<Database>);
  const config=await real.getSearchConfig(slug);
  if(config?.enabled!==true) return [];
  const plan=searchStatementPlanner(database,collection.id,fields);
  try {
    const searchable=fields.filter(field=>field.searchable).map(field=>field.slug);
    if(supports.includes('search')&&searchable.length) await plan.manager.rebuildIndex(slug,searchable,config.weights,config.tokenize);
    else await plan.manager.disableSearch(slug);
    return plan.statements;
  } finally {await plan.close();}
}
export async function planDropCollectionSearch(database:CmsDatabase,slug:string,collectionId:string):Promise<CompiledQuery[]> {
  const plan=searchStatementPlanner(database,collectionId,[]);
  try {await plan.manager.dropFtsTable(slug);return plan.statements;}finally{await plan.close();}
}
