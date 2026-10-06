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
console.log(JSON.stringify({ wholeAuthorities: ledger.authorities.length, wholeFamilies: ledger.wholeFamilies.length, productTestsRun: 0, sourceCausalCredit: 0 }));
