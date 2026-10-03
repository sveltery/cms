import {describe} from 'vitest';
import {Kysely,SqliteDialect,SqliteAdapter,type CompiledQuery} from 'kysely';
import {NodeSqliteCompatDatabase} from '../../src/lib/server/database/node-sqlite-compat.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {registerTaxonomyDatabase,taxonomyDatabase} from '../../src/lib/server/taxonomies/upstream/host.ts';
import {registerLifecycleDatabase} from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import {SchemaRegistry} from '../../src/lib/server/taxonomies/upstream/schema/registry.ts';
import {resetTaxonomyDefsCacheForTests} from '../../src/lib/server/taxonomies/upstream/taxonomies/index.ts';
import {resetRegisteredCollectionsCacheForTests} from '../../src/lib/server/taxonomies/upstream/schema/collection-slugs-cache.ts';
import {waitForDeferredTasks} from '../../src/lib/server/taxonomies/upstream/deferred-tasks.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
export const hasPgTestDatabase=false;export const D1_COMPOUND_SELECT_LIMIT=5;
export type DialectName='sqlite'|'sqlite-d1-budget';export interface DialectTestContext{db:Kysely<any>;dialect:DialectName;database:CmsDatabase}
class BudgetDialect extends SqliteDialect {createAdapter(){const adapter=new SqliteAdapter();Object.assign(adapter,{compoundSelectLimit:5});return adapter;}}
export function registerSourceDatabase(db:Kysely<any>):CmsDatabase {
 const found=taxonomyDatabase(db);if(found)return found;
 const database:CmsDatabase={db,async atomicBatch(statements:readonly CompiledQuery[]){return db.transaction().execute(async tx=>{const result=[];for(const statement of statements)result.push(await tx.executeQuery(statement));return result;});},async close(){await db.destroy();}};
 registerTaxonomyDatabase(database);registerLifecycleDatabase(database);return database;
}
export async function runMigrations(db:Kysely<any>){await migrateCms(registerSourceDatabase(db));resetTaxonomyDefsCacheForTests();resetRegisteredCollectionsCacheForTests();}
export function createTestDatabase(){resetTaxonomyDefsCacheForTests();resetRegisteredCollectionsCacheForTests();const db=new Kysely<any>({dialect:new SqliteDialect({database:new NodeSqliteCompatDatabase(':memory:')})});registerSourceDatabase(db);return db;}
export async function setupTestDatabase(){const db=createTestDatabase();await runMigrations(db);return db;}
export async function setupTestDatabaseWithCollections(){const db=await setupTestDatabase();await collections(db);return db;}
async function collections(db:Kysely<any>){const registry=new SchemaRegistry(db);for(const slug of ['post','page']){await registry.createCollection({slug,label:slug==='post'?'Posts':'Pages',labelSingular:slug==='post'?'Post':'Page'});await registry.createField(slug,{slug:'title',label:'Title',type:'string'});await registry.createField(slug,{slug:'content',label:'Content',type:'portableText'});}}
export async function setupForDialect(dialect:DialectName){const Constructor=dialect==='sqlite-d1-budget'?BudgetDialect:SqliteDialect;const db=new Kysely<any>({dialect:new Constructor({database:new NodeSqliteCompatDatabase(':memory:')})});await runMigrations(db);return{db,dialect,database:registerSourceDatabase(db)};}
export async function setupForDialectWithCollections(dialect:DialectName){const ctx=await setupForDialect(dialect);await collections(ctx.db);return ctx;}
export async function teardownTestDatabase(db:Kysely<any>){await waitForDeferredTasks();await db.destroy();}
export async function teardownForDialect(ctx:DialectTestContext){if(ctx)await teardownTestDatabase(ctx.db);}
export function describeEachDialect(name:string,callback:(name:DialectName)=>void){describe(`${name} (native Node SQLite)`,()=>callback('sqlite'));describe(`${name} (native Node SQLite with five-branch D1 budget; not workerd)`,()=>callback('sqlite-d1-budget'));}
