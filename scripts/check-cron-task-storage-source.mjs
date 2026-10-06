// Complete immutable authority checks; zero executed product callbacks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ledger = JSON.parse(readFileSync('docs/cron-task-storage-ports.json', 'utf8'));
assert.equal(ledger.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
for (const item of ledger.authorities) {
  const bytes = readFileSync(item.local);
  assert.equal(bytes.length, item.bytes, item.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), item.blob, item.path);
  if (process.argv[2]) assert.deepEqual(bytes, execFileSync('git', ['show', ledger.pin + ':' + item.path], { cwd: process.argv[2] }), item.path);
}
const adaptations = JSON.parse(readFileSync('docs/cron-task-storage-native-adaptations.json', 'utf8'));
for (const leaf of adaptations.changedLeaves) {
  let body = readFileSync(leaf.path, 'utf8');
  for (const edit of leaf.edits.toReversed()) {
    assert.equal(body.split(edit.after).length - 1, edit.count, leaf.path);
    body = body.replaceAll(edit.after, edit.before);
  }
  const bytes = Buffer.from(body);
  assert.equal(bytes.length, leaf.baseBytes, leaf.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), leaf.baseSha256, leaf.path);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), leaf.baseBlob, leaf.path);
}
const sourceTypes = readFileSync('parity/emdash/cron-storage-source/upstream/packages/core/src/database/types.ts', 'utf8');
const nativeTypes = readFileSync('src/lib/server/cron/types.ts', 'utf8');
const wholeCronInterface = value => value.match(/^export interface CronTaskTable \{\n[\s\S]*?^\}/m)?.[0];
assert.ok(wholeCronInterface(sourceTypes));
assert.equal(wholeCronInterface(nativeTypes), wholeCronInterface(sourceTypes), 'Whole Cron row interface');
if (ledger.testOnlyTypeTransport) {
  const transport = ledger.testOnlyTypeTransport;
  const nativeTest = readFileSync(transport.path, 'utf8');
  assert.equal(nativeTest.split(transport.after).length - 1, transport.count, transport.path);
  const original = Buffer.from(nativeTest.replaceAll(transport.after, transport.before));
  assert.equal(original.length, transport.beforeBytes, transport.path);
  assert.equal(createHash('sha256').update(original).digest('hex'), transport.beforeSha256, transport.path);
}
for (const receipt of ledger.rawReceipts ?? []) {
  const bytes = readFileSync(receipt.path);
  assert.equal(bytes.length, receipt.bytes, receipt.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256, receipt.path);
}
console.log(JSON.stringify({ wholeAuthorities: ledger.authorities.length, wholeFamilies: ledger.wholeFamilies.length,
  exactFiniteExistingLeaves: adaptations.changedLeaves.length, productTestsRun: 0, sourceCausalCredit: 0 }));
