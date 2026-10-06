import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'parity/emdash/plugin-runtime/runtime-transports.json'), 'utf8'));
const rows = ledger.transports ?? ledger.modules;
const wholeKinds = new Set(['whole-source-runtime-after-import-only-substitution', 'whole-source-runtime-relative-js-to-ts-import-transport', 'whole-source-types-with-MIT-notice']);
let whole = 0;
const finite = [];
for (const row of rows) {
  const bytes = fs.readFileSync(path.join(root, 'parity/emdash/plugin-runtime/source', row.source));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== row.sourceSha256) throw new Error(`Whole Source authority SHA mismatch: ${row.source}`);
  if (!wholeKinds.has(row.body)) { finite.push({ path: row.native, body: row.body, limits: row.limits }); continue; }
  let expected = bytes.toString('utf8');
  for (const substitution of row.imports ?? []) expected = expected.replaceAll(`"${substitution.from}"`, `"${substitution.to}"`);
  if (row.body === 'whole-source-runtime-relative-js-to-ts-import-transport') expected = expected.replaceAll('.js"', '.ts"');
  const actual = fs.readFileSync(path.join(root, row.native), 'utf8');
  const prefix = actual.slice(0, actual.length - expected.length);
  if (!actual.endsWith(expected) || !/^\/\/ Copyright 2026 Cloudflare Inc\. MIT; see notices\/emdash-MIT\.txt\.\n(?:\/\/[^\n]*\n)?$/.test(prefix)) {
    throw new Error(`Whole native module differs from exact Source import transport: ${row.native}`);
  }
  whole++;
}
const host = JSON.parse(fs.readFileSync(path.join(root, 'parity/emdash/plugin-runtime/lifecycle-host-inheritance.json'), 'utf8'));
const actual = fs.readFileSync(path.join(root, host.path), 'utf8');
if (actual.split(host.addedSpan).length !== 2) throw new Error('Lifecycle additive span does not occur exactly once');
const restored = actual.replace(host.addedSpan, '');
const prior = execFileSync('git', ['show', `${host.baseCommit}:${host.path}`], { cwd: root, encoding: 'utf8' });
if (restored !== prior) throw new Error('Whole accepted lifecycle host reconstruction failed');
console.log(JSON.stringify({ sourcePin: ledger.sourcePin, wholeModulesAfterExactImports: whole, finiteAdaptations: finite, everyPriorLifecycleHostByteRetained: true, productParityCredit: 0 }));
