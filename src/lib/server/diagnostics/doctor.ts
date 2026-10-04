// Derived from EmDash 1.1.0 doctor.ts, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { parse as parseToml } from 'smol-toml';
import { openNodeSqliteDatabase } from '../database/node-sqlite-compat.ts';
import { CMS_MIGRATIONS } from '../database/migrations.ts';
import { scanDatetimeStorage, formatDatetimeStorageReport } from './datetime-storage.ts';
import type { Database } from './types.ts';

export interface CheckResult { name: string; status: 'pass' | 'warn' | 'fail'; message: string }
/** Explicit host-library protocol; callers may inspect an independently hosted Worker. */
export interface WorkerContract {
  name: string;
  factory: string;
  exportFix: string;
  module?: string;
  mainPath?: string;
  coverageWarning?: string;
}
const nativeWorker: WorkerContract = {
  name: 'Sveltery revision maintenance', factory: 'createRevisionMaintenanceScheduledHandler',
  mainPath: './build/cloudflare/worker.js',
  exportFix: 'run "pnpm build:cloudflare" to generate the Sveltery Worker wrapper',
  coverageWarning: 'This Worker provides revision maintenance. Full scheduled publishing, cron-task execution and scheduler heartbeat integration remain unfinished.'
};
const WRANGLER_CONFIG_FILES = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'] as const;
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}
async function findWranglerConfig(cwd: string): Promise<string | null> {
  for (const filename of WRANGLER_CONFIG_FILES) {
    const path = resolve(cwd, filename);
    if (await fileExists(path)) return path;
  }
  return null;
}
function sourcePosition(source: string, offset: number) {
  const prefix = source.slice(0, offset);
  return {line: prefix.split('\n').length, column: offset - prefix.lastIndexOf('\n')};
}
function triggerFix(configPath: string) {
  return configPath.endsWith('.toml') ? '[triggers]\ncrons = ["* * * * *"]'
    : '"triggers": { "crons": ["* * * * *"] }';
}
function mainFix(configPath: string, contract: WorkerContract) {
  const path = contract.mainPath ?? './src/worker.ts';
  return configPath.endsWith('.toml') ? `main = "${path}"` : `"main": "${path}"`;
}
async function workerExportsMaintenance(source: string, path: string, contract: WorkerContract) {
  const factory = escaped(contract.factory);
  if (contract.module) {
    const module = escaped(contract.module);
    const reExport = new RegExp(`export\\s*\\{[^}]*\\bdefault\\b[^}]*\\}\\s*from\\s*["']${module}["']`, 'm');
    const importsFactory = new RegExp(`import\\s+[^;]*\\{[^}]*\\b${factory}\\b[^}]*\\}\\s*from\\s*["']${module}["']`, 'm');
    return reExport.test(source) || (importsFactory.test(source) &&
      new RegExp(`\\bscheduled\\s*:\\s*${factory}\\s*\\(`, 'm').test(source));
  }
  // Native diagnostics validate the actual local maintenance module as well as
  // the wrapper shape emitted by build-revision-maintenance.mjs.
  const imported = new RegExp(`import\\s*\\{[^}]*\\b${factory}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`, 'm').exec(source);
  if (!imported || (!imported[1].startsWith('.') && !imported[1].startsWith('/'))) return false;
  const forwarded = new RegExp(`\\bscheduled\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?${factory}\\s*\\([^)]*\\)\\.scheduled\\s*\\(`, 'm');
  const spread = new RegExp(`\\.\\.\\.\\s*${factory}\\s*\\(`, 'm');
  if (!forwarded.test(source) && !spread.test(source)) return false;
  try {
    const module = await readFile(resolve(dirname(path), imported[1]), 'utf8');
    return new RegExp(`export\\s+function\\s+${factory}\\s*\\(`).test(module) ||
      new RegExp(`export\\s*\\{[^}]*\\b${factory}\\b[^}]*\\}`, 'm').test(module);
  } catch { return false; }
}

export async function checkSchedulerWiring(cwd: string, contract: WorkerContract = nativeWorker): Promise<CheckResult[]> {
  const configPath = await findWranglerConfig(cwd);
  if (!configPath) return [];
  return checkSchedulerWiringAtPath(cwd, configPath, contract);
}
async function checkSchedulerWiringAtPath(cwd: string, configPath: string, contract: WorkerContract): Promise<CheckResult[]> {
  const configSource = await readFile(configPath, 'utf8');
  let parsed: unknown;
  if (configPath.endsWith('.toml')) {
    try { parsed = parseToml(configSource); }
    catch (error) {
      const location = isRecord(error) && typeof error.line === 'number' && typeof error.column === 'number'
        ? ` at line ${error.line}, column ${error.column}` : '';
      return [{name: 'scheduler config', status: 'fail', message:
        `could not parse ${configPath}: invalid TOML${location} — fix the Wrangler configuration syntax`}];
    }
  } else {
    const errors: ParseError[] = [];
    parsed = parse(configSource, errors, {allowTrailingComma: true, disallowComments: false});
    if (errors.length) {
      const error = errors[0], {line, column} = sourcePosition(configSource, error.offset);
      return [{name: 'scheduler config', status: 'fail', message:
        `could not parse ${configPath}: ${printParseErrorCode(error.error)} at line ${line}, column ${column} — fix the Wrangler configuration syntax`}];
    }
  }
  if (!isRecord(parsed)) return [{name: 'scheduler config', status: 'fail', message:
    `could not parse ${configPath}: expected an object — fix the Wrangler configuration syntax`}];
  const triggers = isRecord(parsed.triggers) ? parsed.triggers : null;
  const hasCron = Array.isArray(triggers?.crons) && triggers.crons.some(cron => typeof cron === 'string' && cron.trim().length > 0);
  const main = typeof parsed.main === 'string' && parsed.main.trim() ? parsed.main : null;
  if (!main) return [{name: 'scheduler handler', status: 'fail', message:
    `Wrangler configuration has no Worker entry to inspect — add ${mainFix(configPath, contract)}, then export: ${contract.exportFix}`}];
  const workerPath = resolve(cwd, main);
  let hasScheduled = false;
  try {
    hasScheduled = await workerExportsMaintenance(await readFile(workerPath, 'utf8'), workerPath, contract);
  } catch (error) {
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : null;
    if (code !== 'ENOENT') return [{name: 'scheduler handler', status: 'fail', message:
      `could not read Worker entry ${workerPath}: ${error instanceof Error ? error.message : 'unknown I/O error'} — check the file path and permissions`}];
    return [{name: 'scheduler handler', status: 'fail', message:
      `Worker entry not found at ${workerPath} — create it with: ${contract.exportFix}`}];
  }
  if (hasCron && !hasScheduled) return [{name: 'scheduler handler', status: 'fail', message:
    `Cron Trigger is configured, but ${main} does not export ${contract.name} scheduled() maintenance — replace its Worker export with: ${contract.exportFix}`}];
  if (hasScheduled && !hasCron) return [{name: 'scheduler trigger', status: 'fail', message:
    `${contract.name} scheduled() handler is exported, but no Cron Trigger is configured — add this to ${configPath}: ${triggerFix(configPath)}`}];
  if (!hasCron && !hasScheduled) return [];
  const result: CheckResult[] = [{name: 'scheduler wiring', status: 'pass', message:
    `Cron Trigger and scheduled() handler found (${main})`}];
  if (contract.coverageWarning) result.push({name: 'scheduler coverage', status: 'warn', message: contract.coverageWarning});
  return result;
}

async function checkDatabase(path: string): Promise<CheckResult[]> {
  if (!(await fileExists(path))) return [{name: 'database', status: 'fail', message:
    `not found at ${path} — configure the persistent database and complete setup at /setup`}];
  const results: CheckResult[] = [{name: 'database', status: 'pass', message: path}];
  let db: Kysely<Database> | undefined;
  try {
    db = new Kysely<Database>({dialect: new SqliteDialect({database: openNodeSqliteDatabase(path, {readOnly: true})})});
    await sql`SELECT 1`.execute(db);
    let versions: number[] = [];
    try { versions = (await sql<{version: number}>`SELECT version FROM _cms_migrations ORDER BY version`.execute(db)).rows.map(row => row.version); }
    catch (error) {
      if (!(error instanceof Error) || !/no such table: _cms_migrations\b/.test(error.message)) throw error;
    }
    const known = new Set(CMS_MIGRATIONS.map(m => m.version));
    const applied = versions.filter(version => known.has(version));
    const pending = CMS_MIGRATIONS.filter(m => !versions.includes(m.version));
    const unknown = versions.filter(version => !known.has(version));
    const gap = applied.some((version, index) => version !== index + 1);
    results.push(unknown.length || gap ? {name: 'migrations', status: 'fail', message:
      `migration records have ${gap ? 'a gap' : 'no gap'}; unknown versions: ${unknown.join(', ') || 'none'} — inspect the database with the matching Sveltery build`}
      : {name: 'migrations', status: pending.length ? 'warn' : 'pass', message:
        `${applied.length} applied, ${pending.length ? `${pending.length} pending — start the configured Sveltery application to run its registered migrations` : 'none pending'}`});
    try {
      const count = (await sql<{count: number}>`SELECT COUNT(id) as count FROM _cms_collections`.execute(db)).rows[0]?.count ?? 0;
      results.push({name: 'collections', status: count > 0 ? 'pass' : 'warn', message:
        count > 0 ? `${count} collections defined` : 'no collections — seed or create via admin'});
    } catch {
      results.push({name: 'collections', status: 'fail', message: 'could not query collections table — migrations may not have run'});
    }
    try {
      const tables = (await sql<{name: string}>`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ec_%' ORDER BY name`.execute(db)).rows.map(row => row.name);
      const registered = new Set((await sql<{slug: string}>`SELECT slug FROM _cms_collections`.execute(db)).rows.map(row => `ec_${row.slug}`));
      const orphaned = tables.filter(name => !registered.has(name));
      if (orphaned.length) results.push({name: 'orphaned tables', status: 'warn', message: `found ${orphaned.length}: ${orphaned.join(', ')}`});
      try {
        const report = await scanDatetimeStorage(db);
        const clean = report.noncanonicalCount === 0 && report.manualReviewCount === 0 && report.inspectionErrorCount === 0;
        results.push({name: 'datetime storage', status: clean ? 'pass' : 'fail', message: clean
          ? `all stored content datetimes are canonical (${report.timezone})` : formatDatetimeStorageReport(report)});
      } catch (error) {
        results.push({name: 'datetime storage', status: 'fail', message:
          `could not inspect stored datetimes: ${error instanceof Error ? error.message : String(error)}`});
      }
    } catch { /* The collections failure above diagnoses a fresh or incomplete schema. */ }
    try {
      const count = (await sql<{count: number}>`SELECT COUNT(id) as count FROM _cms_auth_users`.execute(db)).rows[0]?.count ?? 0;
      results.push({name: 'users', status: count > 0 ? 'pass' : 'warn', message: count > 0
        ? `${count} authentication identities` : 'no authentication identities — complete setup at /setup'});
    } catch { results.push({name: 'users', status: 'warn', message: 'could not query authentication identities table'}); }
  } catch (error) {
    results.push({name: 'database connection', status: 'fail', message: error instanceof Error ? error.message : 'failed to connect'});
  } finally { if (db) await db.destroy(); }
  return results;
}

export async function checkDoctor(cwd: string, databasePath: string, contract: WorkerContract = nativeWorker): Promise<CheckResult[]> {
  const results = await checkDatabase(databasePath);
  const configPath = await findWranglerConfig(cwd);
  if (configPath) results.push(...await checkSchedulerWiringAtPath(cwd, configPath, contract));
  return results;
}

function formatDoctorResults(results: readonly CheckResult[]): string {
  const fails = results.filter(result => result.status === 'fail').length;
  const warns = results.filter(result => result.status === 'warn').length;
  const summary = fails ? `${fails} issues found` : warns
    ? `All critical checks passed (${warns} warnings)` : 'All checks passed';
  return ['Sveltery Doctor', '',
    ...results.map(result => `${result.status.toUpperCase()} ${result.name}: ${result.message}`),
    '', summary, ''].join('\n');
}

/** Entry used by both the repository launcher and bundled standalone package. */
export async function runDoctorCli(argv = process.argv.slice(2)): Promise<number> {
  const {values} = parseArgs({args: argv, options: {
    database: {type: 'string', short: 'd', default: './data.db'},
    cwd: {type: 'string', default: process.cwd()}, json: {type: 'boolean', default: false},
    help: {type: 'boolean', short: 'h', default: false}
  }});
  if (values.help) {
    process.stdout.write('Usage: doctor [--cwd directory] [--database path | -d path] [--json]\nRead-only database and Worker scheduler configuration diagnostics.\n');
    return 0;
  }
  const cwd = resolve(values.cwd);
  const results = await checkDoctor(cwd, resolve(cwd, values.database));
  if (values.json) process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  else process.stdout.write(formatDoctorResults(results));
  return results.some(result => result.status === 'fail') ? 1 : 0;
}
