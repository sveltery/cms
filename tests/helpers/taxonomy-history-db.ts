// Native test host for complete pinned historical fixtures; not an import engine.
import {describe} from 'vitest';
import {Kysely,SqliteDialect,type CompiledQuery} from 'kysely';
import {Miniflare} from 'miniflare';
import {NodeSqliteCompatDatabase} from '../../src/lib/server/database/node-sqlite-compat.ts';
import {RawBindingD1Dialect} from '../fixtures/taxonomy-history/packages/cloudflare/src/db/d1-dialect.ts';
import {runMigrations} from '../fixtures/taxonomy-history/packages/core/src/database/migrations/runner.ts';
import {SchemaRegistry} from '../fixtures/taxonomy-history/packages/core/src/schema/registry.ts';
import {waitForDeferredTasks} from '../fixtures/taxonomy-history/packages/core/src/deferred-tasks.ts';
import {resetTaxonomyDefsCacheForTests} from '../fixtures/taxonomy-history/packages/core/src/taxonomies/index.ts';
import {resetRegisteredCollectionsCacheForTests} from '../fixtures/taxonomy-history/packages/core/src/schema/collection-slugs-cache.ts';
import {nativeHost} from 'virtual:sveltery/taxonomy-history-native';

export type DialectName='sqlite'|'workerd-d1';
export interface DialectTestContext {
  db:Kysely<any>;
  dialect:DialectName;
  pgCtx?:undefined;
  closeRuntime?:()=>Promise<void>;
  nativeFixture?:boolean;
}

function resetCaches(){
  resetTaxonomyDefsCacheForTests();
  resetRegisteredCollectionsCacheForTests();
  nativeHost?.resetCaches();
}

function registerNative(ctx:DialectTestContext){
  if(!nativeHost)return ctx;
  const db=ctx.db;
  nativeHost.registerTaxonomyDatabase({db,
    async atomicBatch(statements:readonly CompiledQuery[]){
      if(ctx.dialect==='workerd-d1') {
        const adapter=db.getExecutor().adapter as unknown as {executeAtomicBatch(statements:readonly CompiledQuery[]):Promise<any[]>};
        return adapter.executeAtomicBatch(statements);
      }
      return db.transaction().execute(async transaction=>{
        const results=[];
        for(const statement of statements)results.push(await transaction.executeQuery(statement));
        return results;
      });
    },async close(){await teardownForDialect(ctx);}
  });
  return ctx;
}

export async function createForDialect(dialect:DialectName):Promise<DialectTestContext>{
  resetCaches();
  if(dialect==='workerd-d1'){
    // Kysely's pinned Runner needs the pinned introspector and migration lock.
    // Native migrateCms deliberately supplies neither; it is not used here.
    const runtime=new Miniflare({modules:true,script:'export default {fetch(){return new Response("historical fixture");}}',
      compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'taxonomy-history'},d1Persist:false});
    try {
      const db=new Kysely<any>({dialect:new RawBindingD1Dialect({database:await runtime.getD1Database('DB') as any})});
      return registerNative({db,dialect,async closeRuntime(){try{await db.destroy();}finally{await runtime.dispose();}}});
    } catch(error){await runtime.dispose();throw error;}
  }
  return registerNative({db:new Kysely<any>({dialect:new SqliteDialect({database:new NodeSqliteCompatDatabase(':memory:')})}),dialect});
}

export function runMigrationsForDialect(ctx:DialectTestContext){
  // Actual pinned Runner computes and returns applied migrations from execution.
  return runMigrations(ctx.db);
}

export async function setupForDialectWithCollections(dialect:DialectName){
  if(nativeHost){
    // The068 callback asks for current product collections, not an081/083 state.
    const ctx=await nativeHost.setupForDialectWithCollections(dialect);
    return {...ctx,nativeFixture:true};
  }
  const ctx=await createForDialect(dialect);
  try {
    await runMigrationsForDialect(ctx);
    const registry=new SchemaRegistry(ctx.db);
    // Source setupTestDatabaseWithCollections operations; no manual fixture DDL.
    for(const slug of ['post','page']){
      await registry.createCollection({slug,label:slug==='post'?'Posts':'Pages',labelSingular:slug==='post'?'Post':'Page'});
      await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
      await registry.createField(slug,{slug:'content',label:'Content',type:'portableText'});
    }
    return ctx;
  } catch(error) {
    await teardownForDialect(ctx);
    throw error;
  }
}

export async function teardownForDialect(ctx:DialectTestContext|undefined){
  if(!ctx)return;
  if(ctx.nativeFixture){await nativeHost!.teardownForDialect(ctx);return;}
  try {await waitForDeferredTasks();}
  finally {
    if(ctx.closeRuntime)await ctx.closeRuntime();
    else await ctx.db.destroy();
  }
}

export function describeEachDialect(name:string,callback:(dialect:DialectName)=>void){
  const dialect=process.env.SVELTERY_TAXONOMY_HISTORY_TARGET==='workerd-d1'?'workerd-d1':'sqlite';
  describe(`${name} [${nativeHost?'native taxonomy with real historical prestate':'complete pinned reference fixture'}, ${dialect}]`,()=>callback(dialect));
}
