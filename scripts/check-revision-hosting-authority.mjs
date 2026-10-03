import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const ledger=JSON.parse(await readFile('docs/revision-hosting-ports.json','utf8'));
const upstream=process.argv[2];
assert.ok(upstream,'Provide the pinned EmDash clone for complete authority verification');
for(const authority of ledger.inspectedAuthority) {
  assert.equal(execFileSync('git',['rev-parse',`${ledger.pin}:${authority.path}`],{cwd:upstream,encoding:'utf8'}).trim(),authority.blob);
  const original=execFileSync('git',['show',`${ledger.pin}:${authority.path}`],{cwd:upstream});
  assert.equal(createHash('sha256').update(original).digest('hex'),authority.sha256);
}
assert.equal(ledger.sourceHostingTests.ported,0);
assert.equal(ledger.sourceHostingTests.executed,0);
assert.equal(ledger.dependency.newDeclarationCredit,0);
console.log(JSON.stringify({pin:ledger.pin,completeAuthorityFiles:ledger.inspectedAuthority.length,newSourceDeclarations:0,productTestsRun:0}));
