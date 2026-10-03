// Original test hosts only. No successful full-system cleanup is simulated.
import assert from 'node:assert/strict';
import {Kysely as ActualKysely, SqliteDialect as ActualSqliteDialect, OperationNodeTransformer, type CompiledQuery, type QueryResult} from 'kysely';
import {it} from 'node:test';
import {expect as existingExpect} from '../lifecycle-expect.ts';
import {schemaAdminStorage} from '../schema-admin-storage.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../../src/lib/server/database/registry.ts';
import {openNodeSqliteDatabase} from '../../../src/lib/server/database/node-sqlite-compat.ts';
import type {CmsDatabase} from '../../../src/lib/server/database/contract.ts';
import {RevisionRepository as ProductRepository} from '../../../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {RevisionRepository as SourceRepository} from './source-revision.ts';
import {pruneQueuedRevisions as sourceCoordinator} from './source-coordinator.ts';

export {it};
function matcher(actual: unknown, negated=false): any {
  const base=existingExpect(actual);
  return new Proxy(negated?base.not:base,{get(target,key) {
    if(key==='not')return matcher(actual,!negated);
    if(key==='toMatch')return (expected:RegExp)=>assert.equal(expected.test(actual as string),!negated);
    if(key==='toContainEqual')return (expected:unknown)=>assert.equal((actual as unknown[]).some(item=>{
      try {assert.deepEqual(item,expected);return true;}catch{return false;}
    }),!negated);
    return Reflect.get(target,key);
  }});
}
export const expect=matcher;

/** Namespace changes happen outside the complete Source callback/repository. */
class Namespace extends OperationNodeTransformer {
  override transformIdentifier(node: {kind:'IdentifierNode';name:string}) {
    return {...node,name:node.name==='revisions'?'_cms_revisions':node.name.replace(/^_emdash_/,'_cms_')};
  }
  override transformRaw(node: Parameters<OperationNodeTransformer['transformRaw']>[0]) {
    return {...super.transformRaw(node),sqlFragments:node.sqlFragments.map(part=>part.replaceAll('_emdash_','_cms_').replace(/\brevisions\b/g,'_cms_revisions'))};
  }
}
const namespace=new Namespace();
function namespaced(db:any) {
  return db.withPlugin({transformQuery:({node}:any)=>namespace.transformNode(node),transformResult:async({result}:any)=>result});
}
const databases=new WeakMap<object,CmsDatabase>();

export async function setupTestDatabaseWithCollections(target:'Node'|'D1'='Node') {
  const storage=await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    const registry=new SchemaRegistry(storage.database);
    for(const slug of ['post','page']) {
      await registry.createCollection({slug,label:slug});
      await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
    }
    const db=namespaced(storage.database.db);
    Object.defineProperty(db,'destroy',{value:()=>storage.close()});
    databases.set(db,storage.database);
    return db;
  }catch(cause){await storage.close();throw cause;}
}

// The unchanged no-full-history callback explicitly constructs Node SQLite.
// Its log observer sees Source logical names after the namespace substitution.
export class BetterSqlite3 {
  constructor(path:string){return openNodeSqliteDatabase(path);}
}
export class SqliteDialect extends ActualSqliteDialect {
  readonly fixtureDatabase: ReturnType<typeof openNodeSqliteDatabase>;
  constructor(config:any){super(config);this.fixtureDatabase=config.database;}
}
export class Kysely extends ActualKysely<any> {
  constructor(config:any) {
    const observe=config.log;
    super({...config,log:observe?(event:any)=>observe({...event,query:{...event.query,
      sql:event.query.sql.replaceAll('_cms_revisions','revisions').replaceAll('_cms_','_emdash_')}}):undefined});
    const native=config.dialect.fixtureDatabase;
    const database:CmsDatabase={db:this,close:()=>this.destroy(),async atomicBatch(statements:readonly CompiledQuery[]) {
      return database.db.connection().execute(async()=>{
        native.exec('BEGIN IMMEDIATE');
        try {
          const results:QueryResult<unknown>[]=[];
          for(const query of statements){const statement=native.prepare(query.sql);
            if(statement.reader)results.push({rows:statement.all(query.parameters)});
            else {const value=statement.run(query.parameters);results.push({rows:[],numAffectedRows:BigInt(value.changes),insertId:BigInt(value.lastInsertRowid)});}
          }
          native.exec('COMMIT');return results;
        }catch(cause){try{native.exec('ROLLBACK');}catch{}throw cause;}
      });
    }};
    databases.set(this,database);
  }
}
export async function runMigrations(db:any){await migrateCms(databases.get(db)!);}
export class RevisionRepository {
  constructor(db:any){return new (process.env.SVELTERY_REVISION_TEST_MODE==='reference'?SourceRepository:ProductRepository)(namespaced(db));}
}

export async function revisionModule() {
  const path='../../../src/lib/server/maintenance/revisions.ts';
  try{return await import(path);}
  catch(cause){if(cause instanceof Error&&'code' in cause&&cause.code==='ERR_MODULE_NOT_FOUND')return {};throw cause;}
}
export async function runtimeModule() {
  const path='../../../src/lib/server/maintenance/runtime.ts';
  try{return await import(path);}
  catch(cause){if(cause instanceof Error&&'code' in cause&&cause.code==='ERR_MODULE_NOT_FOUND')return {};throw cause;}
}
export async function runSystemCleanup(db:any) {
  const coordinator=process.env.SVELTERY_REVISION_TEST_MODE==='reference'?sourceCoordinator:(await revisionModule()).pruneQueuedRevisions;
  if(typeof coordinator!=='function')throw new Error('Product global revision coordinator is unimplemented');
  // Only the complete revision subfunction is projected. No values are invented
  // for absent challenge, token, media, 404, or transfer subsystems.
  return {revisionsPruned:await coordinator(namespaced(db))};
}
