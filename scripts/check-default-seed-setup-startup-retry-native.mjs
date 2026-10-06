// Supplemental Native retry authority;0execution/Source/security credit.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const ledger = JSON.parse(await read('docs/default-seed-setup-startup-retry-native.json'));
if (sha(await read(ledger.fixture.path)) !== ledger.fixture.sha256) throw new Error('Qualified Native retry fixture changed');
if (sha(await read('src/lib/server/runtime/composition.ts')) !== ledger.productionCurrentSha256) {
  throw new Error('Runtime exceeds its exact reviewed per-request retry phase');
}
const config = await read('vitest.default-seed-setup-caller.config.ts');
const addition = ", 'tests/default-seed-setup/startup-retry-caller.test.ts'";
if (sha(config) !== ledger.configCurrentSha256 || config.split(addition).length !== 2
  || sha(config.replace(addition, '')) !== ledger.configBeforeSha256) {
  throw new Error('Retry config exceeds one approved Native include');
}
console.log('Meaningful Native1 retry fixture and exact reviewed production/config phase qualified;0Source/security/execution credit.');
