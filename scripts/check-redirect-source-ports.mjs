import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const file = 'docs/redirect-ports.json';
const ledger = JSON.parse(await readFile(file, 'utf8'));
const hash = text => createHash('sha256').update(text).digest('hex');
const callbacks = [];
for (const entry of ledger.authority) {
  const bytes = await readFile(entry.local);
  assert.equal(bytes.byteLength, entry.bytes, entry.path);
  assert.equal(hash(bytes), entry.sha256, entry.path);
  if (process.argv[2] && process.argv[2] !== 'write') {
    assert.equal(execFileSync('git', ['rev-parse', `${ledger.pin}:${entry.path}`], {cwd:process.argv[2],encoding:'utf8'}).trim(), entry.blob);
    assert.deepEqual(execFileSync('git', ['show', `${ledger.pin}:${entry.path}`], {cwd:process.argv[2]}), bytes);
  }
  if (entry.kind !== 'whole-source-test') continue;
  const text = bytes.toString('utf8');
  const tree = ts.createSourceFile(entry.path,text,ts.ScriptTarget.Latest,true);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const first = node.arguments[0];
      const callee = node.expression.getText(tree);
      if ((callee === 'it' || callee === 'test' || /^\b(?:it|test)\.each\(/.test(callee)) && first && ts.isStringLiteral(first)) {
        let assertions = 0;
        function count(child) {
          if (ts.isCallExpression(child) && child.expression.getText(tree) === 'expect') assertions++;
          ts.forEachChild(child,count);
        }
        count(node);
        callbacks.push({path:entry.path,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,title:first.text,sha256:hash(node.getText(tree)),assertions});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
}
if (process.argv[2] === 'write') {
 ledger.callbacks = callbacks;
 ledger.copiedDeclarations = callbacks.length;
 ledger.expectExpressions = callbacks.reduce((sum,row)=>sum+row.assertions,0);
 await writeFile(file,JSON.stringify(ledger,null,2)+'\n');
} else {
 assert.deepEqual(callbacks,ledger.callbacks);
 assert.equal(callbacks.length,ledger.copiedDeclarations);
 assert.equal(callbacks.reduce((sum,row)=>sum+row.assertions,0),ledger.expectExpressions);
}
console.log(JSON.stringify({pin:ledger.pin,wholeSourceFiles:ledger.authority.filter(entry=>entry.kind==='whole-source-test').length,wholeAuthorities:ledger.authority.length,declarations:callbacks.length,expectExpressions:callbacks.reduce((sum,row)=>sum+row.assertions,0),productTestsRun:0}));
