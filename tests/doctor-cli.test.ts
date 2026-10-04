// Native CLI, configuration and persisted SQL contracts. No Source assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms, CMS_MIGRATIONS } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';

const cli = fileURLToPath(new URL('../scripts/doctor.mjs', import.meta.url));
const maintenance = fileURLToPath(new URL('../src/lib/server/maintenance/runtime.ts', import.meta.url));
type Check = {name: string; status: 'pass' | 'warn' | 'fail'; message: string};

async function directory(t: test.TestContext) {
  const path = await mkdtemp(join(tmpdir(), 'cms-doctor-native-'));
  t.after(() => rm(path, {recursive: true, force: true}));
  return path;
}
function invoke(cwd: string, ...args: string[]) {
  // No host configuration, identity or credentials enter these subprocesses.
  return spawnSync(process.execPath, [cli, '--cwd', cwd, ...args], {
    env: {PATH: process.env.PATH}, encoding: 'utf8', timeout: 15_000
  });
}
function checks(result: ReturnType<typeof invoke>): Check[] {
  assert.equal(result.error, undefined, result.stderr);
  assert.match(result.stdout, /^\s*\[/, `CLI must produce diagnostics: ${result.stderr}`);
  return JSON.parse(result.stdout) as Check[];
}
async function database(cwd: string) {
  const path = join(cwd, 'data.db');
  const store = openSqlite(path);
  await migrateCms(store);
  await new SchemaRegistry(store).createCollection({slug: 'posts', label: 'Posts'});
  return {path, store};
}
async function worker(cwd: string, crons = true, configName = 'wrangler.jsonc') {
  await mkdir(join(cwd, 'src'));
  await writeFile(join(cwd, 'src/worker.ts'),
    `import app from './app.js';\nimport {createRevisionMaintenanceScheduledHandler} from '${maintenance}';\nexport default {...app,...createRevisionMaintenanceScheduledHandler()};\n`);
  const config = configName === 'wrangler.toml'
    ? `main = "./src/worker.ts"\n${crons ? '[triggers]\ncrons = ["* * * * *"]' : ''}\n`
    : JSON.stringify({main: './src/worker.ts', ...(crons ? {triggers: {crons: ['* * * * *']}} : {})});
  await writeFile(join(cwd, configName), config);
}

test('doctor returns actionable JSON failure without creating a missing database', async t => {
  const cwd = await directory(t);
  const result = invoke(cwd, '--json');
  assert.equal(result.status, 1);
  const results = checks(result);
  assert.deepEqual(results.map(({name, status}) => ({name, status})), [{name: 'database', status: 'fail'}]);
  assert.match(results[0].message, /not found/);
  assert.match(results[0].message, /setup/);
  await assert.rejects(readFile(join(cwd, 'data.db')), {code: 'ENOENT'});
});

test('doctor reads the real installed migrations, collection and empty identity tables without writes', async t => {
  const cwd = await directory(t);
  const {path, store} = await database(cwd);
  await store.close();
  const before = await readFile(path);
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(results.find(r => r.name === 'migrations')?.message, `${CMS_MIGRATIONS.length} applied, none pending`);
  assert.equal(results.find(r => r.name === 'collections')?.message, '1 collections defined');
  assert.equal(results.find(r => r.name === 'users')?.status, 'warn');
  assert.match(results.find(r => r.name === 'users')!.message, /authentication identities/);
  assert.equal(results.find(r => r.name === 'datetime storage')?.status, 'pass');
  assert.deepEqual(await readFile(path), before);
});

test('doctor reports pending migrations from the actual registered provider universe', async t => {
  const cwd = await directory(t);
  const store = openSqlite(join(cwd, 'data.db'));
  await sql`CREATE TABLE _cms_migrations(version INTEGER PRIMARY KEY)`.execute(store.db);
  await sql`INSERT INTO _cms_migrations(version) VALUES (1)`.execute(store.db);
  await store.close();
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.equal(result.status, 1);
  assert.equal(results.find(r => r.name === 'migrations')?.status, 'warn');
  assert.match(results.find(r => r.name === 'migrations')!.message,
    new RegExp(`1 applied, ${CMS_MIGRATIONS.length - 1} pending`));
  assert.equal(results.find(r => r.name === 'collections')?.status, 'fail');
});

test('doctor does not accept unknown or gapped native migration records as fully applied', async t => {
  const cwd = await directory(t);
  const {store} = await database(cwd);
  await sql`DELETE FROM _cms_migrations WHERE version=2`.execute(store.db);
  await sql`INSERT INTO _cms_migrations(version) VALUES(999)`.execute(store.db);
  await store.close();
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.equal(result.status, 1);
  assert.equal(results.find(r => r.name === 'migrations')?.status, 'fail');
  assert.match(results.find(r => r.name === 'migrations')!.message, /999/);
  assert.match(results.find(r => r.name === 'migrations')!.message, /gap/);
});

test('doctor reports actual orphaned content tables without including ordinary operator tables', async t => {
  const cwd = await directory(t);
  const {store} = await database(cwd);
  await sql`CREATE TABLE ec_orphan(id TEXT)`.execute(store.db);
  await sql`CREATE TABLE operator_notes(id TEXT)`.execute(store.db);
  await store.close();
  const results = checks(invoke(cwd, '--json'));
  const orphaned = results.find(r => r.name === 'orphaned tables');
  assert.equal(orphaned?.status, 'warn');
  assert.equal(orphaned?.message, 'found 1: ec_orphan');
});

test('doctor detects noncanonical persisted content and nested/revision datetimes without repairing them', async t => {
  const cwd = await directory(t);
  const {path, store} = await database(cwd);
  const registry = new SchemaRegistry(store);
  await registry.createField('posts', {slug: 'event_date', label: 'Event', type: 'datetime'});
  await registry.createField('posts', {slug: 'schedule', label: 'Schedule', type: 'repeater',
    validation: {subFields: [{slug: 'when', label: 'When', type: 'datetime'}]}});
  await sql`INSERT INTO ec_posts(id,slug,created_at,event_date,schedule) VALUES
    ('date-row','date-row','2026-10-04T01:00:00+01:00','2026-10-04 09:00:00',
    ${JSON.stringify([{when: '2026-10-04T04:00:00+02:00'}])})`.execute(store.db);
  await sql`INSERT INTO _cms_revisions(id,collection,entry_id,data) VALUES
    ('revision-row','posts','date-row',${JSON.stringify({event_date: '2026-10-04T04:00:00+02:00'})})`.execute(store.db);
  await store.close();
  const before = await readFile(path);
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.equal(result.status, 1);
  const dates = results.find(r => r.name === 'datetime storage');
  assert.equal(dates?.status, 'fail');
  assert.match(dates!.message, /4 noncanonical values \(1 naive\) using UTC/);
  assert.match(dates!.message, /ec_posts\/date-row\.schedule/);
  assert.match(dates!.message, /_cms_revisions\/revision-row/);
  assert.deepEqual(await readFile(path), before);
});

test('doctor reports invalid datetime data as an inspection failure', async t => {
  const cwd = await directory(t);
  const {store} = await database(cwd);
  await sql`INSERT INTO ec_posts(id,slug,created_at) VALUES ('bad-date','bad-date','not-a-date')`.execute(store.db);
  await store.close();
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.equal(result.status, 1);
  assert.match(results.find(r => r.name === 'datetime storage')!.message, /1 could not be inspected/);
});

test('doctor combines actual Native Worker wiring diagnostics with a missing local database', async t => {
  const cwd = await directory(t);
  await worker(cwd);
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.equal(result.status, 1);
  assert.equal(results.find(r => r.name === 'database')?.status, 'fail');
  assert.equal(results.find(r => r.name === 'scheduler wiring')?.status, 'pass');
  assert.equal(results.find(r => r.name === 'scheduler coverage')?.status, 'warn');
  assert.match(results.find(r => r.name === 'scheduler coverage')!.message, /revision maintenance/);
});

test('doctor provides Native TOML trigger guidance for a real maintenance handler', async t => {
  const cwd = await directory(t);
  await worker(cwd, false, 'wrangler.toml');
  const results = checks(invoke(cwd, '--json'));
  const trigger = results.find(r => r.name === 'scheduler trigger');
  assert.equal(trigger?.status, 'fail');
  assert.match(trigger!.message, /\[triggers\]\ncrons = \["\* \* \* \* \*"\]/);
  assert.doesNotMatch(trigger!.message, /emdash|PluginBridge/);
});

test('doctor reports JSONC locations and does not print configuration values', async t => {
  const cwd = await directory(t);
  await writeFile(join(cwd, 'wrangler.jsonc'), '{"vars":{"PRIVATE_VALUE":"do-not-print-this"},\nBROKEN}');
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.match(results.find(r => r.name === 'scheduler config')!.message, /line \d+, column \d+/);
  assert.doesNotMatch(result.stdout + result.stderr, /do-not-print-this/);
});

test('doctor reports TOML locations without including configuration source excerpts', async t => {
  const cwd = await directory(t);
  await writeFile(join(cwd, 'wrangler.toml'), 'main = "do-not-print-this" BROKEN');
  const result = invoke(cwd, '--json');
  const results = checks(result);
  assert.match(results.find(r => r.name === 'scheduler config')!.message, /line 1, column 28/);
  assert.doesNotMatch(result.stdout + result.stderr, /do-not-print-this/);
});

test('doctor accepts explicit database paths and prints native human-readable summaries', async t => {
  const cwd = await directory(t);
  const result = invoke(cwd, '-d', 'selected.sqlite');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Sveltery Doctor/);
  assert.match(result.stdout, /selected\.sqlite/);
  assert.match(result.stdout, /1 issues found/);
  assert.doesNotMatch(result.stdout, /data\.db/);
});

test('doctor rejects invalid flags with a useful usage error', async t => {
  const cwd = await directory(t);
  const result = invoke(cwd, '--unknown-flag');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option/);
  const help = invoke(cwd, '--help');
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--database/);
  assert.match(help.stdout, /--json/);
});
