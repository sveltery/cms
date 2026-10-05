import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const packageBytes = readFileSync(join(root, 'package.json'));
const originalPackage = JSON.parse(packageBytes);
const originalChain = originalPackage.scripts['test:source-ports'];
const guardBytes = readFileSync(join(root, 'scripts/check-user-repository-source.mjs'));
const core = 'pnpm test:user-repository-roles';
const admin = 'pnpm test:user-admin';

// Run the complete, unmodified checker against its real frozen Source, Native
// bodies and inventories. Only this controlled package's command chain varies.
function runWholeGuard(chain) {
  const fixture = mkdtempSync(join(tmpdir(), 'sveltery-user-source-gate-'));
  try {
    mkdirSync(join(fixture, 'scripts'));
    writeFileSync(join(fixture, 'scripts/check-user-repository-source.mjs'), guardBytes);
    assert.deepEqual(readFileSync(join(fixture, 'scripts/check-user-repository-source.mjs')), guardBytes);
    for (const entry of ['docs', 'node_modules', 'notices', 'parity', 'src', 'tests', 'vitest.users.config.ts']) {
      symlinkSync(join(root, entry), join(fixture, entry));
    }
    const controlledPackage = JSON.parse(packageBytes);
    controlledPackage.scripts['test:source-ports'] = chain;
    writeFileSync(join(fixture, 'package.json'), JSON.stringify(controlledPackage));
    const result = spawnSync(process.execPath, [join(fixture, 'scripts/check-user-repository-source.mjs')], {
      cwd: fixture, encoding: 'utf8', timeout: 30_000
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr);
    return result;
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

const cases = [
  ['accepts the complete current workload', originalChain, true],
  ['accepts an unrelated future whole feature leaf', `${originalChain} && pnpm test:byline-content-lifecycle-source`, true],
  ['accepts a future admin UI leaf sharing the required command prefix', `${originalChain} && pnpm test:user-admin-ui`, true],
  ['accepts a future repository leaf sharing the required command prefix', `${originalChain} && pnpm test:user-repository-roles-ui`, true],
  ['rejects replacement of the required admin gate by a different command', originalChain.replace(admin, `${admin}-other`), false],
  ['rejects replacement of the required core gate by a different command', originalChain.replace(core, `${core}-other`), false],
  ['rejects a duplicated complete admin gate', `${originalChain} && ${admin}`, false],
  ['rejects a duplicated complete core gate', `${originalChain} && ${core}`, false],
  ['rejects separation of the required adjacent gates', originalChain.replace(`${core} && ${admin}`, `${core} && pnpm test:another-feature && ${admin}`), false],
  ['rejects reversal of the required adjacent gates', originalChain.replace(`${core} && ${admin}`, `${admin} && ${core}`), false],
  ['rejects deletion of the historical workload prefix', originalChain.replace(/^.*? && /, ''), false]
];

for (const [name, chain, accepted] of cases) {
  test(name, () => {
    const result = runWholeGuard(chain);
    if (accepted) {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /23 whole pinned authorities\/MIT/);
    } else {
      assert.notEqual(result.status, 0, `Complete checker accepted an invalid workload:\n${chain}\n${result.stdout}`);
    }
  });
}
