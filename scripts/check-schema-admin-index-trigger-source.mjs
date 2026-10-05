import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const ledger=JSON.parse(readFileSync(resolve(root,'docs/schema-admin-index-trigger-source.json'),'utf8'));
assert.equal(ledger.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(ledger.records.length,4);
for (const record of ledger.records) {
  const bytes=readFileSync(resolve(root,record.destination));
  assert.equal(bytes.length,record.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),record.gitBlob);
}
process.stdout.write('Whole pinned Source001/080/dialect helpers/SQL validation witness authorities are unchanged. Zero original Source callbacks.\n');
