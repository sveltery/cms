// Supplemental diagnostic-package execution; no HTTP, credentials or principals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';

test('standalone frozen production package contains and runs the real doctor command', {timeout: 180_000}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cms-doctor-package-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const directory = join(root, 'app');
  await cp(new URL('../../node-package/', import.meta.url), directory, {recursive: true});
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.bin, {'sveltery-doctor': './build/doctor.js'});
  assert.deepEqual(manifest.scripts, {start: 'node build/index.js'});
  const installed = spawnSync('pnpm', ['install', '--prod', '--frozen-lockfile', '--ignore-scripts',
    '--store-dir', join(root, 'store')], {cwd: directory, encoding: 'utf8', timeout: 120_000});
  assert.equal(installed.error, undefined);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  const path = join(directory, 'operator.sqlite');
  const store = openSqlite(path);
  await migrateCms(store);
  await new SchemaRegistry(store).createCollection({slug: 'posts', label: 'Posts'});
  await store.close();
  const before = await readFile(path);
  const inspected = spawnSync(process.execPath, ['build/doctor.js', '--database', 'operator.sqlite', '--json'], {
    cwd: directory, env: {PATH: process.env.PATH}, encoding: 'utf8', timeout: 15_000
  });
  assert.equal(inspected.error, undefined);
  assert.equal(inspected.status, 0, inspected.stderr);
  const results = JSON.parse(inspected.stdout);
  assert.deepEqual(results.filter((result: {status: string}) => result.status === 'fail'), []);
  assert.equal(results.find((result: {name: string}) => result.name === 'collections').message, '1 collections defined');
  assert.deepEqual(await readFile(path), before);
});
