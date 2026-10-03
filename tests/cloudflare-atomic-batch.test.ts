// Supplemental native CmsDatabase integration; zero upstream assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CompiledQuery } from 'kysely';
import { createRequestScopedDb } from '../src/lib/server/runtime/cloudflare-d1.ts';

function fixture(coalesce: boolean, rejectAtomic = false) {
  let inFlight = 0;
  let maxInFlight = 0;
  let bookmark = '';
  const operations: string[] = [];
  const cookies: string[] = [];
  const failure = new Error('atomic write rejected');
  const result = () => ({ success: true, results: [], meta: { changes: 0, last_row_id: 0 } });
  async function execute(label: string, rows: ReturnType<typeof result>[], fail: boolean) {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    operations.push(label);
    await new Promise(resolve => setTimeout(resolve, 20));
    inFlight--;
    bookmark = label;
    if (fail) throw failure;
    return rows;
  }
  function prepare(sql: string) {
    const statement = { sql, bind(..._parameters: unknown[]) { return statement; },
      async all() { return (await execute(`all:${sql}`, [result()], false))[0]; } };
    return statement;
  }
  const binding = {
    prepare,
    batch(statements: ReturnType<typeof prepare>[]) {
      return execute(`batch:${statements.map(row => row.sql).join('|')}`, statements.map(result),
        rejectAtomic && statements.some(row => row.sql.startsWith('update')));
    },
    withSession() { return binding; }, getBookmark() { return bookmark; }
  };
  const scoped = createRequestScopedDb({ config: { binding: 'CMS_DB', session: 'auto', coalesce },
    binding: binding as never, isAuthenticated: true, isWrite: true,
    cookies: { get() { return undefined; }, set(_name, value) { cookies.push(value); } },
    url: new URL('https://cms.example') })!;
  return { scoped, operations, cookies, failure, maxInFlight: () => maxInFlight,
    read: (table: string) => scoped.db.executeQuery(CompiledQuery.raw(`select * from ${table}`)),
    write: () => scoped.database.atomicBatch([CompiledQuery.raw('update a set n = ?', ['x'])]) };
}

for (const coalesce of [false, true]) {
  test(`native atomic batch follows queued reads and commits the completed write bookmark (${coalesce})`, async () => {
    const f = fixture(coalesce);
    try {
      await Promise.all([f.read('a'), f.read('b'), f.write()]);
      assert.equal(f.maxInFlight(), 1);
      assert.deepEqual(f.operations, coalesce ? ['batch:select * from a|select * from b', 'batch:update a set n = ?'] :
        ['all:select * from a', 'all:select * from b', 'batch:update a set n = ?']);
      f.scoped.commit();
      assert.deepEqual(f.cookies, ['batch:update a set n = ?']);
    } finally { await f.scoped.database.close(); }
  });
  test(`native atomic batch issued before reads remains first (${coalesce})`, async () => {
    const f = fixture(coalesce);
    try {
      await Promise.all([f.write(), f.read('a'), f.read('b')]);
      assert.equal(f.maxInFlight(), 1);
      assert.deepEqual(f.operations, coalesce ? ['batch:update a set n = ?', 'batch:select * from a|select * from b'] :
        ['batch:update a set n = ?', 'all:select * from a', 'all:select * from b']);
      f.scoped.commit();
      assert.deepEqual(f.cookies, [f.operations.at(-1)]);
    } finally { await f.scoped.database.close(); }
  });
  test(`failed native atomic batch rejects its caller and leaves later reads ordered (${coalesce})`, async () => {
    const f = fixture(coalesce, true);
    try {
      const outcomes = await Promise.allSettled([f.write(), f.read('a'), f.read('b')]);
      assert.equal(outcomes[0].status, 'rejected');
      assert.equal((outcomes[0] as PromiseRejectedResult).reason, f.failure);
      assert.ok(outcomes.slice(1).every(outcome => outcome.status === 'fulfilled'));
      assert.equal(f.maxInFlight(), 1);
      assert.deepEqual(f.operations, coalesce ? ['batch:update a set n = ?', 'batch:select * from a|select * from b'] :
        ['batch:update a set n = ?', 'all:select * from a', 'all:select * from b']);
    } finally { await f.scoped.database.close(); }
  });
}
