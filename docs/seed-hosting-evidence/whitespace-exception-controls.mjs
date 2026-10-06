// Supplemental Native evidence-format controls. No Source/product test changes.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const attributes = await readFile(join(root, '.gitattributes'));
const owned = [
  ['bounded-check-first.log', 'blank-at-eof'],
  ['copied-config-seven-first-green.log', 'blank-at-eol'],
  ['current924-hosting-production-export-first-red.log', 'blank-at-eol'],
  ['lazy-context-three-allocation-red.log', 'blank-at-eol'],
  ['original-four-workerd-first-kit-prerequisite.log', 'blank-at-eol'],
  ['original-whole-object-cache.log', 'blank-at-eof'],
  ['parent9a-whole-source-cache35.log', 'blank-at-eof']
].map(([name, allowed]) => ({ path: `docs/seed-hosting-evidence/${name}`, allowed }));
const content = {
  'blank-at-eof': 'literal\n\n',
  'blank-at-eol': 'literal \n',
  'space-before-tab': ' \tliteral\n'
};
const directory = await mkdtemp(join(tmpdir(), 'cms-hosting-whitespace-'));
const results = [];
try {
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  await writeFile(join(directory, '.gitattributes'), attributes);
  execFileSync('git', ['add', '.gitattributes'], { cwd: directory });
  async function inspect(path, problem, permitted) {
    const absolute = join(directory, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content[problem]);
    execFileSync('git', ['add', path], { cwd: directory });
    const actual = spawnSync('git', ['diff', '--cached', '--check', '--', path],
      { cwd: directory, encoding: 'utf8' });
    assert.equal(actual.error, undefined);
    const expected = permitted ? 0 : 2;
    results.push({ path, problem, permitted, exit: actual.status, expected,
      passed: actual.status === expected, diagnostics: actual.stdout + actual.stderr });
  }
  for (const item of owned) {
    for (const problem of Object.keys(content)) {
      await inspect(item.path, problem, problem === item.allowed);
    }
  }
  for (const problem of Object.keys(content)) {
    await inspect('docs/seed-hosting-evidence/unowned-whitespace-control.log', problem, false);
  }
  const output = {
    controls: results.length,
    pass: results.filter(result => result.passed).length,
    fail: results.filter(result => !result.passed).length,
    ownedExactPaths: owned,
    results,
    sourceOrProductBehaviorCredit: 0
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exitCode = output.fail ? 1 : 0;
} finally { await rm(directory, { recursive: true, force: true }); }
