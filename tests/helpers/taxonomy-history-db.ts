// Native test host for complete pinned historical fixtures; not an import engine.
import {describe} from 'vitest';
import {Kysely,SqliteDialect} from 'kysely';
import {NodeSqliteCompatDatabase} from '../../src/lib/server/database/node-sqlite-compat.ts';
import {collectionUpdateStorage} from './collection-update-fixture.ts';
import {runMigrations} from '../fixtures/taxonomy-history/packages/core/src/database/migrations/runner.ts';
import {SchemaRegistry} from '../fixtures/taxonomy-history/packages/core/src/schema/registry.ts';
import {waitForDeferredTasks} from '../fixtures/taxonomy-history/packages/core/src/deferred-tasks.ts';
import {resetTaxonomyDefsCacheForTests} from '../fixtures/taxonomy-history/packages/core/src/taxonomies/index.ts';
import {resetRegisteredCollectionsCacheForTests} from '../fixtures/taxonomy-history/packages/core/src/schema/collection-slugs-cache.ts';

export type DialectName='sqlite'|'workerd-d1';
export interface DialectTestContext {
  db:Kysely<any>;
  dialect:DialectName;
  pgCtx?:undefined;
  closeRuntime?:()=>Promise<void>;
}

function resetCaches(){
  resetTaxonomyDefsCacheForTests();
  resetRegisteredCollectionsCacheForTests();
}

export async function createForDialect(dialect:DialectName):Promise<DialectTestContext>{
  resetCaches();
  if(dialect==='workerd-d1'){
    const storage=await collectionUpdateStorage('D1');
    return {db:storage.database.db,dialect,closeRuntime:()=>storage.close()};
  }
  return {db:new Kysely<any>({dialect:new SqliteDialect({database:new NodeSqliteCompatDatabase(':memory:')})}),dialect};
}

export function runMigrationsForDialect(ctx:DialectTestContext){
  // Actual pinned Runner computes and returns applied migrations from execution.
  return runMigrations(ctx.db);
}

export async function setupForDialectWithCollections(dialect:DialectName){
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
  try {await waitForDeferredTasks();}
  finally {
    if(ctx.closeRuntime)await ctx.closeRuntime();
    else await ctx.db.destroy();
  }
}

export function describeEachDialect(name:string,callback:(dialect:DialectName)=>void){
  const dialect=process.env.SVELTERY_TAXONOMY_HISTORY_TARGET==='workerd-d1'?'workerd-d1':'sqlite';
  describe(`${name} [complete pinned fixture, ${dialect}]`,()=>callback(dialect));
}
