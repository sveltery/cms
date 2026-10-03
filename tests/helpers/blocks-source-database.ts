import {describe} from 'vitest';
import type {Kysely} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {openD1} from '../../src/lib/server/database/d1.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {blocksDatabase} from '../../src/lib/server/blocks/host.ts';
import {asyncD1Storage} from './async-d1-storage.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import type {Database} from '../../src/lib/server/media/source/database/types.ts';
export interface DialectTestContext {db:Kysely<Database>;database:CmsDatabase;dialect:string;runtime?:Awaited<ReturnType<typeof asyncD1Storage>>}
const contexts=new WeakMap<object,DialectTestContext>();
export function sourceBlocksContext(db:object){const ctx=contexts.get(db);if(!ctx)throw new Error('Unregistered native block fixture');return ctx;}
export function describeEachDialect(title:string,callback:(dialect:string)=>void){for(const dialect of ['sqlite','d1'])describe(`${title} [actual ${dialect}]`,()=>callback(dialect));}
export async function createForDialect(dialect:string):Promise<DialectTestContext>{
  const runtime=dialect==='d1'?await asyncD1Storage():undefined;
  const database=runtime?openD1(runtime.binding):openSqlite(':memory:');
  const db=blocksDatabase(database);const ctx={db,database,dialect,runtime};contexts.set(db,ctx);
  // Source metadata has SQL timestamp defaults while native fields supply
  // timestamps explicitly. This fixture import supplies that omitted source
  // INSERT default without editing callbacks or canonical physical DDL.
  const insertInto=db.insertInto.bind(db);
  db.insertInto=((table:any)=>{
    const builder=insertInto(table);
    if(table==='_cms_fields'){
      const values=builder.values.bind(builder);
      builder.values=((input:any)=>values(Array.isArray(input)?input.map(value=>({...value,created_at:value.created_at??new Date().toISOString()})):{...input,created_at:input.created_at??new Date().toISOString()})) as any;
    }
    return builder;
  }) as any;
  return ctx;
}
export async function runMigrationsForDialect(ctx:DialectTestContext){await migrateCms(ctx.database);}
export async function setupForDialect(dialect:string){const ctx=await createForDialect(dialect);try{await runMigrationsForDialect(ctx);return ctx;}catch(cause){await teardownForDialect(ctx);throw cause;}}
export async function teardownForDialect(ctx:DialectTestContext){if(!ctx)return;contexts.delete(ctx.db);await ctx.database.close();await ctx.runtime?.runtime.dispose();}
export async function setupTestDatabase(){return (await setupForDialect('sqlite')).db;}
export async function teardownTestDatabase(db:Kysely<Database>){await teardownForDialect(sourceBlocksContext(db));}
