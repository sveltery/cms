import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
const phases = ['services', 'source', 'hosting'];
const commands = [
  'pnpm install --frozen-lockfile',
  'pnpm check',
  'pnpm test',
  'pnpm test:source-ports',
  'node node_modules/typescript/bin/tsc --project tsconfig.source-ports.json',
  'pnpm test:ui-source',
  'pnpm test:date-time',
  'pnpm build',
  'pnpm test:production',
  'pnpm package:node',
  'pnpm test:node',
  'pnpm build:cloudflare',
  'pnpm test:cloudflare',
];
const phaseCommands = {
  services: commands.slice(0, 3),
  source: [commands[0], ...commands.slice(3, 7)],
  hosting: [commands[0], ...commands.slice(7)],
};

function job(id) {
  const match = workflow.match(new RegExp(`^  ${id}:\\n([\\s\\S]*?)(?=^  [a-z][a-z_-]*:|$(?![\\s\\S]))`, 'm'));
  assert.ok(match, `mandatory job ${id} exists`);
  return match[1];
}

test('normal work uses separate sequential bounded jobs at the same reviewed checkout', () => {
  for (const phase of phases) {
    const body = job(`validate-${phase}`);
    assert.match(body, /^    timeout-minutes: 15$/m);
    assert.match(body, /^    runs-on: ubuntu-latest$/m);
    assert.match(body, /uses: actions\/checkout@v4/);
    assert.match(body, /uses: pnpm\/action-setup@v4\n        with:\n          version: 12\.6\.0/);
    assert.match(body, /uses: actions\/setup-node@v4\n        with:\n          node-version: 24\n          cache: pnpm/);
    assert.match(body, new RegExp(`run: sh scripts/ci-validation-phase\\.sh ${phase}`));
    assert.doesNotMatch(body, /continue-on-error|upload-artifact|download-artifact|ref:|timeout-minutes: (?!15)/);
  }
  assert.doesNotMatch(job('validate-services'), /^    needs:/m);
  assert.match(job('validate-source'), /^    needs: validate-services$/m);
  assert.match(job('validate-hosting'), /^    needs: validate-source$/m);
});

test('required validate runs after every outcome and forwards every mandatory result', () => {
  const body = job('validate');
  assert.match(body, /^    needs: \[validate-services, validate-source, validate-hosting\]$/m);
  assert.match(body, /^    if: \$\{\{ always\(\) \}\}$/m);
  assert.match(body, /^    timeout-minutes: 15$/m);
  assert.match(body, /node scripts\/ci-validation-result\.mjs/);
  for (const phase of phases) {
    assert.ok(body.includes(`needs.validate-${phase}.result`), `${phase} result is mandatory`);
  }
  assert.doesNotMatch(body, /continue-on-error|\|\| true/);
  assert.match(workflow, /^permissions:\n  contents: read\n/m);
});

test('local bootstrap and the entire secured browser job remain byte-exact', () => {
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(readFileSync(join(root, 'scripts/bootstrap.sh'))), '2ee61e1f3c84c6dfbbf69aeb732e3615781e4e2cfb312011d23fb240a75592a8');
  assert.equal(hash(workflow.slice(workflow.indexOf('  browser:\n'))), 'a20f5891e0c2e4fb056f75a10bde8fd026fd711a88b3fe83f656832f4b863e78');
});

function runPhase(phase, failure = '') {
  assert.ok(existsSync(join(root, 'scripts/ci-validation-phase.sh')), 'phase runner prerequisite exists');
  const directory = mkdtempSync(join(tmpdir(), 'cms-ci-command-boundary-'));
  const trace = join(directory, 'trace');
  const executable = (name) => `#!/usr/bin/env sh
if [ "$*" = "--version" ]; then
  printf '%s\\n' "${name === 'pnpm' ? '12.6.0' : 'v24.19.0'}"
  exit 0
fi
printf '%s\\n' '${name} '"$*" >> "$CI_TEST_TRACE"
if [ '${name} '"$*" = "$CI_TEST_FAILURE" ]; then exit 17; fi
`;
  for (const name of ['node', 'pnpm']) {
    writeFileSync(join(directory, name), executable(name), { mode: 0o755 });
  }
  try {
    const result = spawnSync('sh', [join(root, 'scripts/ci-validation-phase.sh'), phase], {
      cwd: tmpdir(), encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, CI_TEST_TRACE: trace, CI_TEST_FAILURE: failure },
    });
    return { ...result, trace: existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : [] };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const phase of phases) {
  test(`${phase} executes its complete original command boundary and frozen prerequisite`, () => {
    const result = runPhase(phase);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.trace[0], /^node -e /);
    assert.deepEqual(result.trace.slice(1), phaseCommands[phase]);
    assert.equal((result.stdout.match(/\[validate\] start:/g) ?? []).length, phaseCommands[phase].length);
    assert.equal((result.stdout.match(/\[validate\] finished:/g) ?? []).length, phaseCommands[phase].length);
  });
  for (const command of phaseCommands[phase]) {
    test(`${phase} stops at ${command} and preserves its failure status`, () => {
      const result = runPhase(phase, command);
      assert.equal(result.status, 17, result.stderr);
      const index = phaseCommands[phase].indexOf(command);
      assert.deepEqual(result.trace.slice(1), phaseCommands[phase].slice(0, index + 1));
      assert.equal((result.stdout.match(/\[validate\] start:/g) ?? []).length, index + 1);
      assert.equal((result.stdout.match(/\[validate\] finished:/g) ?? []).length, index);
    });
  }
}

test('ordered phases execute all thirteen original commands exactly once plus two isolated frozen installs', () => {
  const traces = phases.map((phase) => runPhase(phase).trace.slice(1));
  assert.deepEqual([...traces[0], ...traces[1].slice(1), ...traces[2].slice(1)], commands);
});

test('unknown or missing phase rejects before executing any prerequisite or workload', () => {
  for (const phase of ['', 'unknown']) {
    const result = runPhase(phase);
    assert.equal(result.status, 2);
    assert.deepEqual(result.trace, []);
  }
});

function aggregate(results) {
  assert.ok(existsSync(join(root, 'scripts/ci-validation-result.mjs')), 'aggregate runner prerequisite exists');
  return spawnSync(process.execPath, [join(root, 'scripts/ci-validation-result.mjs'), ...results], {
    cwd: tmpdir(), encoding: 'utf8',
  });
}

test('required aggregate succeeds only after all three normal jobs succeed', () => {
  const result = aggregate(['success', 'success', 'success']);
  assert.equal(result.status, 0, result.stderr);
});

test('required aggregate fails closed for failure, cancellation, skipping, empty and unknown results in each job', () => {
  for (const outcome of ['failure', 'cancelled', 'skipped', '', 'unknown']) {
    for (let index = 0; index < phases.length; index += 1) {
      const results = ['success', 'success', 'success'];
      results[index] = outcome;
      const result = aggregate(results);
      assert.equal(result.status, 1, `${phases[index]}=${outcome}: ${result.stderr}`);
      assert.match(result.stderr, new RegExp(phases[index]));
    }
  }
});

test('missing or extra mandatory aggregate results are rejected', () => {
  for (const results of [[], ['success'], ['success', 'success'], ['success', 'success', 'success', 'success']]) {
    assert.equal(aggregate(results).status, 1);
  }
});
