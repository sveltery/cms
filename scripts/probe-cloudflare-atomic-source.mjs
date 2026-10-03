// Reproduce the pinned source limitation; no product or source-parity test credit.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
const [upstream, toolsDirectory] = process.argv.slice(2);
if (!upstream || !toolsDirectory) throw new Error('Pass pinned EmDash checkout and a tools directory containing node_modules/kysely@0.29.2 and kysely-d1@0.4.0');
const dependencies = resolve(toolsDirectory, 'node_modules');
for (const [name, version] of [['kysely', '0.29.2'], ['kysely-d1', '0.4.0']]) {
  if (JSON.parse(readFileSync(join(dependencies, name, 'package.json'), 'utf8')).version !== version) throw new Error(`Expected ${name}@${version}`);
}
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const paths = [
  'packages/cloudflare/src/db/coalescing-d1.ts', 'packages/cloudflare/src/db/d1-dialect.ts',
  'packages/cloudflare/src/db/d1-introspector.ts', 'packages/core/src/database/migration-lock.ts',
  'packages/core/src/database/pg-migration-lock.ts', 'packages/core/src/database/dialect-helpers.ts',
  'packages/core/src/database/validate.ts', 'packages/core/src/utils/db-errors.ts'
];
const evidence = JSON.parse(readFileSync(new URL('../docs/cloudflare-atomic-source-proof.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'cms-pinned-atomic-'));
try {
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}\n');
  for (const path of paths) {
    const data = execFileSync('git', ['-C', upstream, 'show', `${pin}:${path}`]);
    const row = evidence.sourceFiles.find(row => row.path === path);
    const blob = execFileSync('git', ['-C', upstream, 'rev-parse', `${pin}:${path}`], { encoding: 'utf8' }).trim();
    if (!row || blob !== row.blob || createHash('sha256').update(data).digest('hex') !== row.sha256) throw new Error(`Source proof mismatch: ${path}`);
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), data);
  }
  writeFileSync(join(directory, 'hooks.mjs'), `
    import { registerHooks } from 'node:module';
    import { existsSync } from 'node:fs';
    import { fileURLToPath, pathToFileURL } from 'node:url';
    const root=${JSON.stringify(directory + '/')}, dependencies=${JSON.stringify(dependencies + '/')};
    registerHooks({ resolve(specifier, context, next) {
      const packages = { 'kysely': 'kysely/dist/index.js', 'kysely/migration': 'kysely/dist/migration/index.js', 'kysely-d1': 'kysely-d1/dist/index.js' };
      if (packages[specifier]) return { url: pathToFileURL(dependencies + packages[specifier]).href, shortCircuit: true };
      if (specifier === 'emdash/internal/database/migration-lock') return { url: pathToFileURL(root + 'packages/core/src/database/migration-lock.ts').href, shortCircuit: true };
      if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith(pathToFileURL(root).href)) {
        const url = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      }
      return next(specifier, context);
    } });
  `);
  writeFileSync(join(directory, 'probe.mts'), `
    import assert from 'node:assert/strict';
    import { Kysely, CompiledQuery, sql } from 'kysely';
    import { CoalescingD1Dialect } from './packages/cloudflare/src/db/coalescing-d1.ts';
    import { EmDashD1Dialect } from './packages/cloudflare/src/db/d1-dialect.ts';
    import { executeAtomicBatchIfSupported } from './packages/core/src/database/dialect-helpers.ts';
    for (const coalesce of [false, true]) {
      let inFlight = 0, maxInFlight = 0; const operations: string[] = [];
      async function hold(label: string, value: unknown) {
        inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); operations.push(label);
        await new Promise(resolve => setTimeout(resolve, 20)); inFlight--; return value;
      }
      const ok = () => ({ success: true, results: [], meta: { changes: 0, last_row_id: 0 } });
      function prepare(text: string) {
        const statement = { sql: text, bind(..._params: unknown[]) { return statement; }, all() { return hold('all:' + text, ok()); } }; return statement;
      }
      const database = { prepare, batch(statements: ReturnType<typeof prepare>[]) {
        return hold('batch:' + statements.map(row => row.sql).join('|'), statements.map(ok));
      } };
      const db = new Kysely({ dialect: coalesce ? new CoalescingD1Dialect({ database: database as never }) : new EmDashD1Dialect({ database: database as never }) });
      try {
        await Promise.all([db.executeQuery(CompiledQuery.raw('select * from a')), db.executeQuery(CompiledQuery.raw('select * from b')),
          executeAtomicBatchIfSupported(db, [sql.raw('update a set n = ?')])]);
        console.log(JSON.stringify({ coalesce, maxInFlight, operations })); assert.equal(maxInFlight, 2);
      } finally { await db.destroy(); }
    }
  `);
  const run = spawnSync(process.execPath, ['--experimental-transform-types', '--import', join(directory, 'hooks.mjs'), join(directory, 'probe.mts')], { encoding: 'utf8' });
  process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally { rmSync(directory, { recursive: true, force: true }); }
