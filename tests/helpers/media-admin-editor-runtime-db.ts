// Finite whole-Source fixture transport. The database, SQL log and results remain real.
import {Kysely as ActualKysely,SqliteDialect as ActualSqliteDialect,OperationNodeTransformer,type KyselyConfig,type KyselyPlugin,type SqliteDialectConfig,type TableNode,type QueryResult} from 'kysely';
import {NodeSqliteCompatDatabase} from '../../src/lib/server/database/node-sqlite-compat.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import type {CmsDatabase,CmsTables} from '../../src/lib/server/database/contract.ts';
import {registerBlockDatabaseHost} from '../../src/lib/server/blocks/upstream/host.ts';
import {assertExecutableAtomicQueries,executeAtomicQueryLoop} from '../../src/lib/server/database/atomic-query-loop.ts';
export * from 'kysely';

export const mediaRuntimeSourceTables:Readonly<Record<string,string>>=Object.freeze({
 _emdash_collections:'_cms_collections',_emdash_fields:'_cms_fields',
 media:'_cms_media',media_folders:'_cms_media_folders',options:'_cms_options',
 _emdash_media_upload_attempts:'_cms_media_upload_attempts',
 _emdash_media_usage_sources:'_cms_media_usage_sources',_emdash_media_usage:'_cms_media_usage',
 _emdash_media_usage_cleanup:'_cms_media_usage_cleanup',
 _emdash_media_usage_generation_writes:'_cms_media_usage_generation_writes',
 _emdash_media_usage_cleanup_fence:'_cms_media_usage_cleanup_fence',
 _emdash_media_usage_index_status:'_cms_media_usage_index_status',
 _emdash_media_usage_activation:'_cms_media_usage_activation',
 _emdash_media_usage_work:'_cms_media_usage_work',
 _emdash_media_usage_collection_deletions:'_cms_media_usage_collection_deletions',
 _emdash_media_usage_reconciliations:'_cms_media_usage_reconciliations',
});
class SourceTables extends OperationNodeTransformer {
 protected override transformTable(node:TableNode):TableNode {
  const real=super.transformTable(node);
  const name=real.table.schema===undefined?mediaRuntimeSourceTables[real.table.identifier.name]:undefined;
  return name?{...real,table:{...real.table,identifier:{...real.table.identifier,name}}}:real;
 }
}
const transformer=new SourceTables();
const namespace:KyselyPlugin={transformQuery:({node})=>transformer.transformNode(node),transformResult:async({result})=>result};
const owners=new WeakMap<object,CmsDatabase>();

/** Capture only the actual synchronous SQLite handle passed by the original fixture. */
export class SqliteDialect extends ActualSqliteDialect {
 readonly sourceFixtureSqlite:NodeSqliteCompatDatabase;
 constructor(config:SqliteDialectConfig) {
  if(!(config.database instanceof NodeSqliteCompatDatabase))throw new Error('Unknown Source media SQLite fixture');
  super(config);this.sourceFixtureSqlite=config.database;
 }
}
export class Kysely<DB> extends ActualKysely<DB> {
 constructor(config:KyselyConfig) {
  if(!(config.dialect instanceof SqliteDialect))throw new Error('Unknown Source media executor');
  super({...config,plugins:[...(config.plugins??[]),namespace]});
  const native=config.dialect.sourceFixtureSqlite,db=this;
  const owner:CmsDatabase={db:db as unknown as ActualKysely<CmsTables>,atomicQueryLoops:true,
   async atomicBatch(statements) {
      assertExecutableAtomicQueries(statements);
      // Acquire Kysely's connection mutex, then keep the whole native transaction synchronous.
      // Awaiting between statements would let a second connection block Node while this one holds its lock.
      return db.connection().execute(async () => {
        native.exec('BEGIN IMMEDIATE');
        try {
          const results: QueryResult<unknown>[] = [];
          const execute = (query: typeof statements[number]): QueryResult<unknown> => {
            const statement = native.prepare(query.sql);
            if (statement.reader) return { rows: statement.all(query.parameters) };
            else {
              const result = statement.run(query.parameters);
              return { rows: [], numAffectedRows: BigInt(result.changes), insertId: BigInt(result.lastInsertRowid) };
            }
          };
          for (const query of statements) results.push(executeAtomicQueryLoop(query,execute));
          native.exec('COMMIT');
          return results;
        } catch (cause) {
          try { native.exec('ROLLBACK'); }
          catch { /* SQLite may already have rolled back on an I/O failure. */ }
          throw cause;
        }
      });
    },async close(){await db.destroy();}
  };
  owners.set(this,owner);registerBlockDatabaseHost(owner);
 }
}
export function mediaRuntimeFixtureOwner(db:object):CmsDatabase {
 const owner=owners.get(db);if(!owner)throw new Error('Unknown Source media database');return owner;
}
export async function runMigrations(db:object):Promise<void> {await migrateCms(mediaRuntimeFixtureOwner(db));}
