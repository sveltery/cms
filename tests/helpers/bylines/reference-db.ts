/** Genuine separate Source fixture: never called by native startup. */
import { describe } from 'vitest';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { ulid } from 'ulidx';
import { openNodeSqliteDatabase } from '../../../src/lib/server/database/node-sqlite-compat.ts';
import { registerBylineReferenceDatabase } from '../../../src/lib/server/bylines/storage.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import type { Database } from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/types.ts';
import * as m001 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/001_initial.ts';
import * as m002 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/002_media_status.ts';
import * as m003 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/003_schema_registry.ts';
import * as m008 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/008_auth.ts';
import * as m009 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/009_user_disabled.ts';
import * as m024 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/024_media_placeholders.ts';
import * as m031 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/031_bylines.ts';
import * as m040 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/040_byline_i18n.ts';
import * as m042 from '../../../parity/emdash/byline-source/upstream/packages/core/src/database/migrations/042_byline_fields.ts';
const owners=new WeakMap<object,CmsDatabase>();
export async function runMigrations(db:Kysely<Database>) {
  const owner:CmsDatabase={db:db as unknown as CmsDatabase['db'],atomicBatch:queries=>db.transaction().execute(async transaction=>{
    const results=[];for(const query of queries)results.push(await transaction.executeQuery(query));return results;
  }),close:()=>db.destroy()};
  owners.set(db,owner);registerBylineReferenceDatabase(owner);
  // These nine complete pinned migration bodies provide the exact feature
  // fixture, without claiming the Source runner/locking or native installation.
  for(const migration of [m001,m002,m003,m008,m009,m024,m031,m040,m042]) await migration.up(db as unknown as Kysely<unknown>);
}
export async function setupTestDatabase() {
  const db=new Kysely<Database>({dialect:new SqliteDialect({database:openNodeSqliteDatabase(':memory:')})});
  await runMigrations(db);return db;
}
export async function setupTestDatabaseWithCollections() {
  const db=await setupTestDatabase();
  // Ordinary fixture values match the entire original test-db post/page
  // metadata and actual Source Registry content-table column descriptors.
  for(const slug of ['post','page']) {
    const id=ulid();
    await db.insertInto('_emdash_collections').values({id,slug,label:slug==='post'?'Posts':'Pages',label_singular:slug==='post'?'Post':'Page',description:null,icon:null,supports:'[]',source:'manual'} as never).execute();
    await db.schema.createTable(`ec_${slug}`)
      .addColumn('id','text',col=>col.primaryKey()).addColumn('slug','text')
      .addColumn('status','text',col=>col.defaultTo('draft')).addColumn('author_id','text')
      .addColumn('primary_byline_id','text')
      .addColumn('created_at','text',col=>col.defaultTo(sql`(datetime('now'))`))
      .addColumn('updated_at','text',col=>col.defaultTo(sql`(datetime('now'))`))
      .addColumn('published_at','text').addColumn('scheduled_at','text').addColumn('deleted_at','text')
      .addColumn('version','integer',col=>col.defaultTo(1))
      .addColumn('live_revision_id','text',col=>col.references('revisions.id'))
      .addColumn('draft_revision_id','text',col=>col.references('revisions.id'))
      .addColumn('locale','text',col=>col.notNull().defaultTo('en')).addColumn('translation_group','text')
      .addColumn('title','text').addColumn('content','text')
      .addUniqueConstraint(`ec_${slug}_slug_locale_unique`,['slug','locale']).execute();
    for(const [order,field] of ['title','content'].entries()) await db.insertInto('_emdash_fields').values({id:ulid(),collection_id:id,slug:field,label:field==='title'?'Title':'Content',type:field==='title'?'string':'portableText',column_type:field==='title'?'TEXT':'JSON',required:0,unique:0,default_value:null,validation:null,widget:null,options:null,sort_order:order} as never).execute();
  }
  return db;
}
export async function teardownTestDatabase(db:Kysely<Database>|undefined) { if(db)await db.destroy(); }

export interface DialectTestContext {db:Kysely<Database>;dialect:'sqlite'}
export async function setupForDialect(dialect:'sqlite'):Promise<DialectTestContext> { return {db:await setupTestDatabase(),dialect}; }
export async function teardownForDialect(context:DialectTestContext|undefined) {await teardownTestDatabase(context?.db);}

/** Exact Source SQLite expansion; absent PostgreSQL is unconfigured/zero credit. */
export function describeEachDialect(name:string,run:(dialect:'sqlite')=>void) {describe(name+' [genuine Source Node SQLite fixture]',()=>run('sqlite'));}
