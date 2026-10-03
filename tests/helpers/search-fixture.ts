// Test-host substitutions only; all collection/content storage uses real CMS providers.
import { describe } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeRegistry } from '../../src/lib/server/database/registry.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import { registerLifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { Database } from '../../src/lib/server/database/lifecycle/upstream/database/types.ts';
import type { Kysely } from 'kysely';
export { ContentRepository };
const databases = new WeakMap<object, CmsDatabase>();
export class SchemaRegistry extends NativeRegistry {
  constructor(db: Kysely<Database>) { super(databases.get(db)!); }
}
export async function setupTestDatabase(): Promise<Kysely<Database>> {
  const database = openSqlite(':memory:');
  databases.set(database.db,database);registerLifecycleDatabase(database);
  await migrateCms(database);return database.db as unknown as Kysely<Database>;
}
export async function teardownTestDatabase(db: Kysely<Database>) { await databases.get(db)!.close(); }
export async function setupTestDatabaseWithCollections() {
  const db=await setupTestDatabase();const registry=new SchemaRegistry(db);
  for(const slug of ['post','page']) {
    await registry.createCollection({slug,label:slug,labelSingular:slug});
    await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
    await registry.createField(slug,{slug:'content',label:'Content',type:'portableText'});
  }
  return db;
}
export function describeEachDialect(title:string,callback:(dialect:string)=>void) {
  // This dedicated run selects SQLite; D1 is a separate real binding host run.
  return describe(title,()=>callback('sqlite'));
}
export type DialectTestContext = { db: Kysely<Database> };
export async function setupForDialect(_dialect:string):Promise<DialectTestContext> {return {db:await setupTestDatabase()};}
export async function teardownForDialect(ctx:DialectTestContext) {await teardownTestDatabase(ctx.db);}
export async function handleContentCreate(db:Kysely<Database>, type:string, input:Record<string,unknown>) {
  try{return {success:true,data:{item:await new ContentRepository(db).create({type,...input,data:input.data as Record<string,unknown>})}};}
  catch(cause){return {success:false,error:{message:String(cause)}};}
}
export async function handleContentList(db:Kysely<Database>,type:string,input:Record<string,unknown>) {
  try{return {success:true,data:await new ContentRepository(db).findMany(type, {limit:input.limit as number|undefined})};}
  catch(cause){return {success:false,error:{message:String(cause)}};}
}
// Byte-identical fixture function from immutable packages/core/tests/utils/fixtures.ts.
export function createPostFixture(overrides: Partial<CreateContentInput> = {}): CreateContentInput {
	return {
		type: "post",
		slug: "hello-world",
		data: {
			title: "Hello World",
			content: [
				{
					_type: "block",
					style: "normal",
					children: [
						{
							_type: "span",
							text: "This is a test post",
						},
					],
				},
			],
		},
		status: "draft",
		...overrides,
	};
}
import type { CreateContentInput } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/types.ts';
