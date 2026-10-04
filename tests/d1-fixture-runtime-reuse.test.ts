// Original test-harness requirements. No copied EmDash assertions or parity credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { asyncD1Storage } from './helpers/async-d1-storage.ts';

async function freshPair() {
  const first = await asyncD1Storage();
  try { return { first, second: await asyncD1Storage() }; }
  catch (cause) { await first.runtime.dispose(); throw cause; }
}

async function sqliteFiles(storage: Awaited<ReturnType<typeof asyncD1Storage>>) {
  const directory = storage.runtime.unsafeGetPersistPaths().get('d1');
  assert.ok(directory, 'actual Miniflare D1 storage has a physical directory');
  // metadata.sqlite is Miniflare's runtime database catalog, not a leased D1 DB.
  return (await readdir(directory, { recursive: true }))
    .filter(file => file.endsWith('.sqlite') && basename(file) !== 'metadata.sqlite')
    .map(file => join(directory, file)).sort();
}

test('fresh D1 fixtures keep separate real databases while sharing their runtime', { timeout: 30000 }, async () => {
  const { first, second } = await freshPair();
  try {
    await first.binding.prepare('CREATE TABLE first_only(value TEXT)').all();
    await first.binding.prepare('INSERT INTO first_only VALUES (?)').bind('first').all();
    await second.binding.prepare('CREATE TABLE second_only(value TEXT)').all();
    await second.binding.prepare('INSERT INTO second_only VALUES (?)').bind('second').all();
    await assert.rejects(() => second.binding.prepare('SELECT * FROM first_only').all(), /no such table/);
    await assert.rejects(() => first.binding.prepare('SELECT * FROM second_only').all(), /no such table/);
    const physicalFiles = new Set([...await sqliteFiles(first), ...await sqliteFiles(second)]);
    assert.equal(physicalFiles.size, 2, 'each fixture must own a different physical D1 database');
    assert.equal(String(await first.runtime.ready), String(await second.runtime.ready),
      'fresh leases must share one actual Miniflare endpoint');
  } finally { await first.runtime.dispose(); await second.runtime.dispose(); }
});

test('closing one D1 fixture rejects stale queries and leaves its peer intact', { timeout: 30000 }, async () => {
  const { first, second } = await freshPair();
  let firstClosed = false;
  try {
    await first.binding.prepare('CREATE TABLE closed_fixture(value TEXT)').all();
    await second.binding.prepare('CREATE TABLE retained_fixture(value TEXT)').all();
    await second.binding.prepare('INSERT INTO retained_fixture VALUES (?)').bind('retained').all();
    await first.runtime.dispose();
    firstClosed = true;
    await assert.rejects(() => first.binding.prepare('SELECT * FROM closed_fixture').all());
    assert.deepEqual((await second.binding.prepare('SELECT * FROM retained_fixture').all()).results,
      [{ value: 'retained' }]);
  } finally { if (!firstClosed) await first.runtime.dispose(); await second.runtime.dispose(); }
});

test('D1 runtime groups rotate after 256 distinct databases without recycling a closed database', { timeout: 30000 }, async () => {
  // Keep the first lease alive across the boundary. A reused-and-cleared database
  // cannot satisfy the unique physical-file count and retained first-table check.
  const { first, second } = await freshPair();
  const leases = [first, second];
  try {
    assert.equal(String(await first.runtime.ready), String(await second.runtime.ready),
      'ordinary fresh fixtures must reuse the actual runtime before the boundary');
    const existingFiles = new Set(await sqliteFiles(first));
    const endpoints = new Set<string>();
    const files = new Set<string>();
    for (let index = 0; index < 257; index++) {
      const storage = leases[index] ?? await asyncD1Storage();
      leases[index] = storage;
      endpoints.add(String(await storage.runtime.ready));
      await storage.binding.prepare('CREATE TABLE distinct_fixture(value INTEGER)').all();
      await storage.binding.prepare('INSERT INTO distinct_fixture VALUES (?)').bind(index).all();
      for (const file of await sqliteFiles(storage)) if (!existingFiles.has(file)) files.add(file);
      if (index > 0) await storage.runtime.dispose();
    }
    assert.equal(endpoints.size, 2, '257 real fixtures require two bounded runtime groups');
    assert.equal(files.size, 257, 'all 257 fixtures keep distinct physical D1 databases');
    assert.deepEqual((await first.binding.prepare('SELECT * FROM distinct_fixture').all()).results,
      [{ value: 0 }]);
  } finally { for (const storage of leases) await storage.runtime.dispose(); }
});

test('persistent D1 fixtures retain their dedicated runtime and actual data across restart', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-d1-reuse-persistent-'));
  let persistent: Awaited<ReturnType<typeof asyncD1Storage>> | undefined;
  const independent = await asyncD1Storage();
  try {
    persistent = await asyncD1Storage(directory);
    assert.notEqual(String(await persistent.runtime.ready), String(await independent.runtime.ready));
    await persistent.binding.prepare('CREATE TABLE persisted(value TEXT)').all();
    await persistent.binding.prepare('INSERT INTO persisted VALUES (?)').bind('survives').all();
    const originalFiles = await sqliteFiles(persistent);
    await persistent.runtime.dispose();
    persistent = await asyncD1Storage(directory);
    assert.deepEqual(await sqliteFiles(persistent), originalFiles);
    assert.deepEqual((await persistent.binding.prepare('SELECT * FROM persisted').all()).results,
      [{ value: 'survives' }]);
    await assert.rejects(() => independent.binding.prepare('SELECT * FROM persisted').all(), /no such table/);
  } finally {
    await persistent?.runtime.dispose(); await independent.runtime.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
