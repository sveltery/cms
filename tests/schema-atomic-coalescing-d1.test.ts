// Supplemental actual local D1 adapter contracts for SCATOMR3REV01.
// No auth/session credentials, protected HTTP or Source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql, type CompiledQuery } from 'kysely';
import { localD1 } from './helpers/local-d1-fixture.ts';
import { atomicQueryLoop } from '../src/lib/server/database/atomic-query-loop.ts';
import { CoalescingD1Connection } from '../src/lib/server/database/coalescing-d1.ts';
import { createRequestScopedDb } from '../src/lib/server/runtime/cloudflare-d1.ts';

async function fixture() {
  const actual=await localD1();
  await sql`CREATE TABLE coalescing_guard_values(id INTEGER PRIMARY KEY,value TEXT)`.execute(actual.database.db);
  await sql`INSERT INTO coalescing_guard_values(id,value) VALUES(1,'original')`.execute(actual.database.db);
  const events:string[]=[];
  const transport={
    prepare(text:string) {events.push('prepare:'+text);return actual.binding.prepare(text);},
    batch(statements:Parameters<typeof actual.binding.batch>[0]) {events.push('batch');return actual.binding.batch(statements);},
    withSession() {return transport;},getBookmark() {return '';}
  };
  const scoped=createRequestScopedDb({config:{binding:'DB',session:'auto',coalesce:true},binding:transport as never,
    isAuthenticated:false,isWrite:false,cookies:{get(){return undefined;},set(){throw new Error('No bookmark write requested');}},
    url:new URL('https://cms.example')});
  assert.ok(scoped);
  return {actual,scoped,events,async close(){await scoped.database.close();await actual.database.close();await actual.runtime.dispose();}};
}
for(const mode of ['registered','serialized'] as const) {
  test(`coalescing actual D1 refuses ${mode} dynamic operations before flushing, preparing or enqueuing`,{timeout:30_000},async()=>{
    const f=await fixture();
    try {
      const select=sql`SELECT id FROM coalescing_guard_values WHERE value='original'`.compile(f.actual.database.db);
      const registered=atomicQueryLoop(select,()=>[sql`UPDATE coalescing_guard_values SET value='repaired' WHERE id=1`.compile(f.actual.database.db)]);
      const operation=mode==='registered'?registered:JSON.parse(JSON.stringify(registered)) as CompiledQuery;
      const unwanted=sql`UPDATE coalescing_guard_values SET value='unwanted' WHERE id=1`.compile(f.actual.database.db);
      await assert.rejects(()=>f.scoped.database.atomicBatch([operation,unwanted]),{code:'MIGRATION_REQUIRED'});
      assert.deepEqual(f.events,[],'request-scoped batch must refuse before preparing or calling the binding');
      assert.deepEqual((await sql`SELECT value FROM coalescing_guard_values WHERE id=1`.execute(f.actual.database.db)).rows,[{value:'original'}]);
      await f.scoped.db.getExecutor().provideConnection(async connection=>{
        assert.ok(connection instanceof CoalescingD1Connection);
        const pending=connection.executeQuery<{value:string}>(sql`SELECT value FROM coalescing_guard_values WHERE id=1`.compile(f.actual.database.db));
        const alreadyPrepared=[...f.events];
        try {
          await assert.rejects(()=>connection.executeAtomicBatch([operation,unwanted]),{code:'MIGRATION_REQUIRED'});
          assert.deepEqual(f.events,alreadyPrepared,'refusal must leave the previously buffered read unflushed');
        }finally {
          // Existing Source timer and actual storage complete the ordinary read.
          assert.deepEqual((await pending).rows,[{value:'original'}]);
        }
      });
      assert.deepEqual((await sql`SELECT value FROM coalescing_guard_values WHERE id=1`.execute(f.actual.database.db)).rows,[{value:'original'}]);
    }finally{await f.close();}
  });
}

test('coalescing actual D1 ordinary atomic writes and real result positions remain intact',{timeout:30_000},async()=>{
  const f=await fixture();
  try {
    const queries=[sql`UPDATE coalescing_guard_values SET value='ordinary' WHERE id=1`.compile(f.actual.database.db),
      sql`SELECT id,value FROM coalescing_guard_values ORDER BY id`.compile(f.actual.database.db)];
    const results=await f.scoped.database.atomicBatch(queries);
    assert.equal(results.length,2);
    assert.equal(results[0].numAffectedRows,1n);
    assert.deepEqual(results[1].rows,[{id:1,value:'ordinary'}]);
    assert.deepEqual(f.events,['prepare:'+queries[0].sql,'prepare:'+queries[1].sql,'batch']);
    assert.deepEqual((await sql`SELECT id,value FROM coalescing_guard_values ORDER BY id`.execute(f.actual.database.db)).rows,[{id:1,value:'ordinary'}]);
  }finally{await f.close();}
});
