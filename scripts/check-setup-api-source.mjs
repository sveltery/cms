// Inventory/provenance checks only; no CMS or Source test is executed.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ledger = JSON.parse(readFileSync(resolve(root, 'docs/setup-api-source.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(resolve(root, 'parity/emdash/setup-api-source/inventory.json'), 'utf8'));
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
if (ledger.sourcePin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e' || catalog.commit !== ledger.sourcePin) {
  throw new Error('Unexpected setup Source authority.');
}
const paths = new Set();
for (const record of ledger.authorities) {
  if (paths.has(record.path)) throw new Error(`Duplicate authority: ${record.path}`);
  paths.add(record.path);
  const bytes = readFileSync(resolve(root, record.destination));
  const gitBlob = digest(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), 'sha1');
  if (bytes.length !== record.bytes || digest(bytes) !== record.sha256 || gitBlob !== record.sourceBlob) {
    throw new Error(`Source authority changed: ${record.path}`);
  }
}
const executable = resolve(root, 'parity/emdash/setup-api-source/upstream/packages/core/tests/unit/auth/me-welcome-dismiss.test.ts');
if (existsSync(executable)) {
  const original = ledger.authorities.find(record => record.path === 'packages/core/tests/unit/auth/me-welcome-dismiss.test.ts');
  if (digest(readFileSync(executable)) !== original.sha256) throw new Error('Whole executable welcome family changed.');
}
let declarations = 0, expectations = 0;
for (const file of catalog.files) {
  const authority = ledger.authorities.find(record => record.path === file.path);
  if (!authority || authority.sourceBlob !== file.sourceBlob || authority.sha256 !== file.sourceSha256) {
    throw new Error(`Test inventory has no complete matching authority: ${file.path}`);
  }
  declarations += file.tests.length;
  expectations += file.sharedAssertions.length + file.tests.reduce((sum, test) => sum + test.assertions.length, 0);
  for (const test of file.tests) {
    if (test.sourceId !== `${ledger.sourcePin}:${file.path}:${test.line}`) throw new Error('Source declaration ID changed.');
  }
}
if (ledger.authorities.length !== 50 || catalog.files.length !== 9 || declarations !== 48 || expectations !== 193) {
  throw new Error('Whole setup Source declaration/assertion inventory changed.');
}
console.log(JSON.stringify({ authorities: paths.size, wholeTestFamilies: catalog.files.length,
  declarations, expectExpressions: expectations, productTestsRun: 0, sourceCausalCredit: 0 }));
