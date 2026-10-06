import { describe } from 'vitest';
import { Miniflare } from 'miniflare';
import type { Kysely } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { generalMediaDatabase as mediaDatabase } from '../../src/lib/server/general-media/storage.ts';
import type { Database } from '../../src/lib/server/general-media/upstream/database/types.ts';

// Actual canonical providers1–9; public named development dependencies6–8
// remain unapproved and require final own-only replay onto their approved main.
export interface DialectTestContext {db:Kysely<Database>; database:CmsDatabase; dialect:string; worker?:Miniflare}
const contexts = new WeakMap<Kysely<Database>,DialectTestContext>();
export function mediaSourceDatabase(db:Kysely<Database>):CmsDatabase {const ctx=contexts.get(db);if(!ctx)throw new Error("Unknown media database");return ctx.database;}
export function describeEachDialect(title:string, callback:(dialect:string)=>void) {
  for (const dialect of ['sqlite','d1']) describe(`${title} [actual ${dialect}]`,()=>callback(dialect));
}
export async function setupForDialect(dialect:string):Promise<DialectTestContext> {
  let worker:Miniflare|undefined;
  const database = dialect==='d1' ? await (async()=>{
    worker=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{MEDIA_DB:'media-source'}});
    return openD1(await worker.getD1Database('MEDIA_DB'));
  })() : openSqlite(':memory:');
  try {
    await migrateCms(database);
    const ctx={database,db:mediaDatabase(database),dialect,worker};contexts.set(ctx.db,ctx);return ctx;
  } catch (cause) { await database.close();await worker?.dispose();throw cause; }
}
export async function teardownForDialect(ctx:DialectTestContext) {await ctx.database.close();await ctx.worker?.dispose();contexts.delete(ctx.db);}
export async function setupTestDatabase() {return (await setupForDialect('sqlite')).db;}
export async function teardownTestDatabase(db:Kysely<Database>) {const ctx=contexts.get(db);if(!ctx)throw new Error('Unknown media fixture');await teardownForDialect(ctx);}
