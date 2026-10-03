// Source preservation guard only; zero product behavior or copied-test credit.
import {it} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
it('RV1: whole Source callbacks and namespace-only coordinator retain their recorded hashes',()=>{
  const result=JSON.parse(execFileSync(process.execPath,['scripts/check-revision-maintenance-source-ports.mjs'],{encoding:'utf8'}));
  assert.equal(result.wholeDeclarations,8);
  assert.equal(result.expectExpressions,27);
  assert.equal(result.coordinatorNamespaceOnly,true);
  assert.equal(result.productTestsRun,0);
});
