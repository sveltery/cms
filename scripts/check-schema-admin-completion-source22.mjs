import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('docs/schema-admin-completion-source.json', root), 'utf8'));
const proposal = ledger.executableSource22Proposal;
assert.equal(ledger.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(proposal.totalWholeFamilies, 3);
assert.equal(proposal.totalExpandedCallbacks, 22);
assert.equal(proposal.totalDirectExpectCalls, 38);
assert.equal(proposal.families.length, 3);
for (const family of proposal.families) {
  const bytes = await readFile(new URL(family.executable, root));
  const authority = await readFile(new URL(family.authority, root));
  assert.deepEqual(bytes, authority, family.source);
  assert.equal(bytes.length, family.bytes, family.source);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), family.sha256, family.source);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), family.gitBlob, family.source);
}
console.log('Schema Source22: three whole byte-exact families, 22 callbacks, 38 direct expects; provenance only.');
