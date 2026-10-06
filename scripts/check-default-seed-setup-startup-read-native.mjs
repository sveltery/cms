// Exact supplemental Native readonly metadata failure control;0execution credit.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const ledger = JSON.parse(await read('docs/default-seed-setup-startup-read-native.json'));
if (sha(await read(ledger.fixture.path)) !== ledger.fixture.sha256) throw new Error('Readonly Native fixture changed');
for (const [path, hash] of Object.entries(ledger.oldCallerFiles)) {
  if (sha(await read(path)) !== hash) throw new Error('Existing whole six Native caller controls changed');
}
let config = await read('vitest.default-seed-setup-caller.config.ts');
const retryLedger = JSON.parse(await read('docs/default-seed-setup-startup-retry-native.json'));
const retryAddition = ", 'tests/default-seed-setup/startup-retry-caller.test.ts'";
if (sha(config) !== retryLedger.configCurrentSha256 || config.split(retryAddition).length !== 2
  || sha(config.replace(retryAddition, '')) !== retryLedger.configBeforeSha256) {
  throw new Error('Native retry config exceeds its single approved successor include');
}
config = config.replace(retryAddition, '');
const addition = ", 'tests/default-seed-setup/startup-read-caller.test.ts'";
if (sha(config) !== ledger.configCurrentSha256 || config.split(addition).length !== 2
  || sha(config.replace(addition, '')) !== ledger.configBeforeSha256) {
  throw new Error('Native config exceeds its single approved include');
}
console.log('Readonly Native1 and whole previous six caller bodies/config qualified;0Source/security/execution credit.');
