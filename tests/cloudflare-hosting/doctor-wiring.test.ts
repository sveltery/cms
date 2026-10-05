// Static diagnostic of the real built official Worker; no requests or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('native doctor inspects the actual built revision-maintenance Worker and reports bounded coverage', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'cms-doctor-worker-'));
  t.after(() => rm(temporary, {recursive: true, force: true}));
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const worker = await readFile(join(root, 'build/cloudflare/worker.js'), 'utf8');
  const maintenance = await readFile(join(root, 'build/cloudflare/maintenance.js'), 'utf8');
  await mkdir(join(temporary, 'built'));
  await writeFile(join(temporary, 'built/worker.js'), worker);
  await writeFile(join(temporary, 'built/maintenance.js'), maintenance);
  await writeFile(join(temporary, 'wrangler.jsonc'), JSON.stringify({main: './built/worker.js',
    triggers: {crons: ['* * * * *']}}));
  const result = spawnSync(process.execPath, [join(root, 'scripts/doctor.mjs'), '--cwd', temporary, '--json'], {
    env: {PATH: process.env.PATH}, encoding: 'utf8', timeout: 15_000
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, 'the local database is deliberately absent');
  const checks = JSON.parse(result.stdout);
  assert.equal(checks.find((check: {name: string}) => check.name === 'scheduler wiring').status, 'pass');
  assert.equal(checks.find((check: {name: string}) => check.name === 'scheduler coverage').status, 'warn');
  assert.equal(checks.find((check: {name: string}) => check.name === 'database').status, 'fail');
});
