import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { qualifyDashboardSource } from './qualify-dashboard-welcome-source.mjs';

const guard = spawnSync(process.execPath, ['scripts/check-dashboard-welcome-source.mjs'], { stdio: 'inherit' });
if (guard.status !== 0) process.exit(guard.status ?? 1);
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error('Run this gate with pnpm test:dashboard-welcome-source.');
const directory = mkdtempSync(join(tmpdir(), 'dashboard-source33-'));
const reportPath = join(directory, 'whole-source33-report.json');
const logPath = join(directory, 'whole-source33.log');
const args = ['exec', 'vitest', 'run', '--config', 'vitest.dashboard-welcome-source.config.ts', '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`];
const scriptLauncher = /\.(?:m?js|cjs)$/.test(pnpm);
const run = spawnSync(scriptLauncher ? process.execPath : pnpm, scriptLauncher ? [pnpm, ...args] : args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const log = (run.stdout ?? '') + (run.stderr ?? ''); writeFileSync(logPath, log); process.stdout.write(log);
if (run.error || run.signal) throw run.error ?? new Error(`Source runner terminated by ${run.signal}`);
const bytes = readFileSync(reportPath);
const qualification = qualifyDashboardSource({ report: JSON.parse(bytes), rawLog: log, runnerExit: run.status,
  sources: JSON.parse(readFileSync('parity/emdash/dashboard-welcome-source/sources.json', 'utf8')) });
const receipt = { ...qualification, reportPath, logPath, reportBytes: bytes.length,
  reportSha256: createHash('sha256').update(bytes).digest('hex'), logSha256: createHash('sha256').update(log).digest('hex') };
writeFileSync(join(directory, 'qualification.json'), JSON.stringify(receipt, null, 2) + '\n');
// Print the complete actual JSON report for CI auditing as well as the raw child
// log. Gate success is an explicit qualification, never an all33 Source pass.
process.stdout.write(`\nCOMPLETE_UNCHANGED_SOURCE33_REPORT\n${bytes}\n`);
console.log(JSON.stringify(receipt));
