// Adapted from EmDash 1.1.0 (913cb1b); unchanged from initial 1.0.1 port.
// Copyright 2026 Cloudflare Inc.
// MIT; see notices/emdash-LICENSE and docs/database-parity.md for source mapping.
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kysely, SqliteDialect } from 'kysely';
import { NodeSqliteCompatDatabase, openNodeSqliteDatabase } from '../src/lib/server/database/node-sqlite-compat.ts';

// Node returns rows with null prototypes; compare their exact property values.
const plain = (rows: unknown[]) => rows.map(row => ({ ...row as Record<string, unknown> }));
describe('ported openNodeSqliteDatabase', () => {
  const databases: NodeSqliteCompatDatabase[] = [];
  const directories: string[] = [];
  afterEach(() => {
    for (const database of databases.splice(0)) database.close();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });
  function open(path = ':memory:', options?: { journalMode?: 'wal' }) {
    const database = openNodeSqliteDatabase(path, options); databases.push(database); return database;
  }
  function temporaryPath() {
    const directory = mkdtempSync(join(tmpdir(), 'cms-node-sqlite-')); directories.push(directory); return join(directory, 'data.db');
  }
  it('implements the statement contract Kysely uses', async () => {
    const database = open();
    const db = new Kysely<{ entries: { id: number | null; title: string } }>({ dialect: new SqliteDialect({ database }) });
    await db.schema.createTable('entries').addColumn('id', 'integer', c => c.primaryKey().autoIncrement()).addColumn('title', 'text', c => c.notNull()).execute();
    const inserted = await db.insertInto('entries').values({ title: 'First entry' }).returning('id').executeTakeFirstOrThrow();
    assert.equal(inserted.id, 1);
    assert.deepEqual(plain(await db.selectFrom('entries').selectAll().execute()), [{ id: 1, title: 'First entry' }]);
    await db.destroy();
  });
  it('supports direct statement calls', () => {
    const database = open();
    database.exec('CREATE TABLE entries (id INTEGER PRIMARY KEY, title TEXT NOT NULL)');
    const insert = database.prepare('INSERT INTO entries (title) VALUES (?)'); insert.run('First'); insert.run('Second');
    assert.equal(database.open, true);
    assert.deepEqual(plain(database.prepare('SELECT title FROM entries ORDER BY id').all()), [{ title: 'First' }, { title: 'Second' }]);
    assert.deepEqual({ ...database.prepare('SELECT title FROM entries WHERE id = ?').get(2) as object }, { title: 'Second' });
  });
  it('can be closed more than once', () => {
    const database = open(); database.close(); assert.doesNotThrow(() => database.close()); assert.equal(database.open, false);
  });
  it('normalizes supported positional values without shifting parameters', () => {
    const database = open();
    database.prepare('CREATE TABLE values_test (a, b, c, d, e, f)').run([]);
    database.prepare('INSERT INTO values_test VALUES (?, ?, ?, ?, ?, ?)').run([undefined, true, false, 7n, 'text', new Uint8Array([1, 2])]);
    assert.deepEqual(plain(database.prepare('SELECT * FROM values_test').all([]))[0], { a: null, b: 1, c: 0, d: 7, e: 'text', f: new Uint8Array([1, 2]) });
  });
  for (const [name, value] of [['plain object', {}], ['array', []], ['date', new Date('2026-01-01T00:00:00.000Z')], ['boxed number', new Number(1)]] as const) {
    it('rejects an unsupported ' + name + ' before executing the statement', () => {
      const database = open();
      database.prepare('CREATE TABLE rejected_values (first, second)').run([]);
      assert.throws(() => database.prepare('INSERT INTO rejected_values VALUES (?, ?)').run([value, 'must-not-shift']), /Cannot bind/);
      assert.deepEqual(plain(database.prepare('SELECT COUNT(*) AS count FROM rejected_values').all([])), [{ count: 0 }]);
    });
  }
  it('applies connection defaults without changing the journal mode', () => {
    const database = open(temporaryPath());
    for (const [pragma, expected] of [['journal_mode', { journal_mode: 'delete' }], ['synchronous', { synchronous: 2 }], ['cache_size', { cache_size: -16000 }], ['busy_timeout', { timeout: 5000 }], ['foreign_keys', { foreign_keys: 1 }]] as const) {
      assert.deepEqual(plain(database.prepare('PRAGMA ' + pragma).all([])), [expected]);
    }
  });
  it('switches to WAL with NORMAL synchronization when requested', () => {
    const database = open(temporaryPath(), { journalMode: 'wal' });
    assert.deepEqual(plain(database.prepare('PRAGMA journal_mode').all([])), [{ journal_mode: 'wal' }]);
    assert.deepEqual(plain(database.prepare('PRAGMA synchronous').all([])), [{ synchronous: 1 }]);
    assert.deepEqual(plain(database.prepare('PRAGMA cache_size').all([])), [{ cache_size: -16000 }]);
  });
  it('keeps NORMAL synchronization when reopening an existing WAL database without the option', () => {
    const path = temporaryPath(); const first = open(path, { journalMode: 'wal' }); first.close();
    const runtime = open(path);
    assert.deepEqual(plain(runtime.prepare('PRAGMA journal_mode').all([])), [{ journal_mode: 'wal' }]);
    assert.deepEqual(plain(runtime.prepare('PRAGMA synchronous').all([])), [{ synchronous: 1 }]);
  });
});
