import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const ledger = JSON.parse(readFileSync(new URL('../docs/rich-editor-source.json', import.meta.url), 'utf8'));
assert.equal(ledger.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(ledger.wholeSourceFamilies.length, 32);
for (const authority of ledger.authorities) {
  const bytes = readFileSync(new URL(`../${authority.copy}`, import.meta.url));
  assert.equal(bytes.length, authority.bytes, authority.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), authority.sha256, authority.path);
  assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex'), authority.gitBlob, authority.path);
}
for (const family of ledger.wholeSourceFamilies) {
  const authority = ledger.authorities.find(row => row.path === family.path);
  assert.ok(authority, family.path);
  assert.equal(authority.sha256, family.sha256, family.path);
  assert.equal(authority.bytes, family.bytes, family.path);
}
console.log(`Rich editor Source guard: 32 whole families and ${ledger.authorities.length} exact immutable files retained. Execution credit is recorded separately.`);
