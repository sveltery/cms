import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const ledger=JSON.parse(readFileSync(resolve(root,'docs/schema-admin-completion-source.json'),'utf8'));
const proposal=ledger.standardCollectionIndexesForwardRuntime;
assert.equal(proposal.sourcePin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(proposal.sourceAuthorities.length,4);
for (const record of proposal.sourceAuthorities) {
  const bytes=readFileSync(resolve(root,record.destination));
  assert.equal(bytes.length,record.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),record.sourceGitBlob);
}
assert.equal(createHash('sha256').update(readFileSync(resolve(root,'notices/emdash-MIT.txt'))).digest('hex'),'d5ab82c0225b0def1fa140af22ff2f3bed9791a527545be1b04ab4337dc88675');
process.stdout.write('Whole collection-index Registry/Source055/074/080 authorities and MIT are unchanged. No Source callback execution credit.\n');
