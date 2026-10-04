// Original native dependency/read-only assertions; no identity/session probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { installHistoricalCanonical5 } from './helpers/historical-canonical5.ts';
import { commentsReady } from '../src/lib/server/comments/readiness.ts';
import { commentSchemaSql } from '../src/lib/server/comments/migrations.ts';
import { commentRuntimeSchemaSql } from '../src/lib/server/comments/runtime-migrations.ts';
import { asyncD1Storage } from './helpers/async-d1-storage.ts';
for(const target of ['Node SQLite','raw D1'] as const) {
 for(const dependency of ['options','rate limits'] as const) {
  test(`comments ${target} readiness refuses missing ${dependency} before requests`,{timeout:30000},async()=>{
   const worker=target==='raw D1'?await asyncD1Storage():undefined;
   const database=worker?openD1(worker.binding):openSqlite(':memory:');
   try {
    await installHistoricalCanonical5(database);
    await database.atomicBatch([...commentSchemaSql, ...commentRuntimeSchemaSql.filter(statement => dependency === 'options' ? statement.includes('_cms_comment_rate_limits') : statement.includes('_cms_comment_options'))].map(statement=>sql.raw(statement).compile(database.db)));
    const before=(await sql`SELECT name, sql FROM sqlite_schema ORDER BY name`.execute(database.db)).rows;
    assert.equal(await commentsReady(database),false);
    assert.deepEqual((await sql`SELECT name, sql FROM sqlite_schema ORDER BY name`.execute(database.db)).rows,before);
   } finally {await database.close();await worker?.runtime.dispose();}
  });
 }
}
