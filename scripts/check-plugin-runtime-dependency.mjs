import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const prior = '82e3dd7b673f774ca8c3eceaafa28234641bd6b1';
const priorLock = execFileSync('git', ['show', `${prior}:pnpm-lock.yaml`], { encoding: 'utf8' });
let retained = fs.readFileSync('pnpm-lock.yaml', 'utf8');
const additions = [
  '      croner:\n        specifier: 10.0.1\n        version: 10.0.1\n',
  "  croner@10.0.1:\n    resolution: {integrity: sha512-ixNtAJndqh173VQ4KodSdJEI6nuioBWI0V1ITNKhZZsO0pEMoDxz539T4FTTbSZ/xIOSuDnzxLVRqBVSvPNE2g==}\n    engines: {node: '>=18.0'}\n\n",
  '\n  croner@10.0.1: {}\n'
];
for (const addition of additions) {
  assert.equal(retained.split(addition).length, 2, 'Expected exactly one genuine additive croner lock block');
  retained = retained.replace(addition, '');
}
assert.equal(retained, priorLock, 'Every prior dependency/policy/lock byte must remain exact');
const oldPackage = JSON.parse(execFileSync('git', ['show', `${prior}:package.json`], { encoding: 'utf8' }));
const currentPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.equal(currentPackage.dependencies.croner, '10.0.1');
delete currentPackage.dependencies.croner;
assert.deepEqual(currentPackage, oldPackage, 'All unrelated package values must remain exact');
const installed = JSON.parse(fs.readFileSync('node_modules/croner/package.json', 'utf8'));
assert.equal(installed.version, '10.0.1');
assert.equal(installed.license, 'MIT');
const license = fs.readFileSync('node_modules/croner/LICENSE');
assert.deepEqual(fs.readFileSync('notices/croner-MIT.txt'), license);
console.log(JSON.stringify({ prior, everyPriorLockByteRetained: true, selectedVersion: installed.version,
  installedLicenseSha256: crypto.createHash('sha256').update(license).digest('hex'), productParityCredit: 0 }));
