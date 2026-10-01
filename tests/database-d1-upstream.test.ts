// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Adapted from EmDash 1.1.0, 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e,
// packages/cloudflare/tests/db/d1-dialect.test.ts. Source lines in docs/d1-ports.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CompiledQuery, Kysely } from 'kysely';
import { openD1, RawBindingD1Dialect, type D1Binding, type D1Statement } from '../src/lib/server/database/d1.ts';

interface MockStatement extends D1Statement { sql: string; params: unknown[] }
function createMockD1(rows: Record<string, unknown>[] = []) {
  const allCalls: string[] = []; const batchCalls: MockStatement[][] = [];
  let inFlight = 0; let maxInFlight = 0;
  const database: D1Binding = {
    prepare(sql): MockStatement {
      const stmt: MockStatement = {
        sql, params: [],
        bind(...params) { stmt.params = params; return stmt; },
        async all() {
          inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise(resolve => setTimeout(resolve, 5));
          inFlight--; allCalls.push(sql);
          return { success: true, results: rows, meta: { changes: 0, last_row_id: 0 } };
        }
      };
      return stmt;
    },
    async batch(statements) {
      batchCalls.push(statements as MockStatement[]);
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      return results;
    }
  };
  return { database, allCalls, batchCalls, maxInFlight: () => maxInFlight };
}

test('source: raw binding reports supportsMultipleConnections: true', () => {
  const { database } = createMockD1();
  assert.equal(new RawBindingD1Dialect(database).createAdapter().supportsMultipleConnections, true);
});
test('source: lets concurrent queries overlap instead of serializing behind a mutex', async () => {
  const { database, allCalls, maxInFlight } = createMockD1();
  const db = new Kysely({ dialect: new RawBindingD1Dialect(database) });
  try {
    await Promise.all([db.executeQuery(CompiledQuery.raw('select 1')), db.executeQuery(CompiledQuery.raw('select 2'))]);
    assert.equal(maxInFlight(), 2); assert.equal(allCalls.length, 2);
  } finally { await db.destroy(); }
});
test('source: raw adapter declares the compound SELECT ceiling', () => {
  const { database } = createMockD1();
  assert.equal(new RawBindingD1Dialect(database).createAdapter().compoundSelectLimit, 5);
});
test('source: raw adapter exposes atomic batches', () => {
  const { database } = createMockD1();
  assert.equal(typeof new RawBindingD1Dialect(database).createAdapter().executeAtomicBatch, 'function');
});
test('source: forwards compiled statements to one binding batch and maps results', async () => {
  const { database, batchCalls } = createMockD1();
  const cms = openD1(database);
  try {
    const results = await cms.atomicBatch([
      CompiledQuery.raw('update entries set title = ?', ['Restored']),
      CompiledQuery.raw('insert into revisions (id) values (?)', ['revision-1'])
    ]);
    assert.equal(batchCalls.length, 1);
    assert.deepEqual(batchCalls[0]?.map(statement => [statement.sql, statement.params]), [
      ['update entries set title = ?', ['Restored']], ['insert into revisions (id) values (?)', ['revision-1']]
    ]);
    assert.equal(results.length, 2);
  } finally { await cms.close(); }
});
test('source: preserves DELETE RETURNING rows through the raw binding dialect', async () => {
  const rows = [{ storage_key: 'expired.png' }]; const { database } = createMockD1(rows);
  const cms = openD1(database);
  try {
    const result = await cms.db.executeQuery(CompiledQuery.raw('delete from "media" where "status" = ? returning "storage_key"', ['pending']));
    assert.deepEqual(result.rows, rows);
  } finally { await cms.close(); }
});

// Supplemental liveness evidence: upstream overlap assertion does not cancel an I/O promise.
test('local: an unsettled first binding read does not block the next query', async () => {
  const { database } = createMockD1(); const prepare = database.prepare.bind(database);
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  database.prepare = query => {
    const statement = prepare(query);
    if (query === 'select 1') {
      const all = statement.all.bind(statement);
      statement.all = async () => { await pending; return all(); };
    }
    return statement;
  };
  const cms = openD1(database); const first = cms.db.executeQuery(CompiledQuery.raw('select 1'));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([cms.db.executeQuery(CompiledQuery.raw('select 2')), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('second query blocked')), 1000);
    })]);
  } finally { clearTimeout(timer); finish(); await first; await cms.close(); }
});
