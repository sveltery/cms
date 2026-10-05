import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const manifest = JSON.parse(await readFile('docs/query-sdk-source.json', 'utf8'));
assert.equal(manifest.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
const hash = value => createHash('sha256').update(value).digest('hex');
let declarations = 0;
let expectations = 0;
for (const file of manifest.files) {
  const bytes = await readFile(file.path);
  assert.equal(bytes.byteLength, file.bytes, file.source);
  assert.equal(hash(bytes), file.sha256, file.source);
  assert.equal(execFileSync('git', ['hash-object', '--stdin'], {input:bytes}).toString().trim(), file.gitBlob);
  if (process.argv[2]) assert.deepEqual(execFileSync('git', ['show', `${manifest.pin}:${file.source}`], {cwd:process.argv[2]}), bytes);
  if (file.kind !== 'whole-test') continue;
  const tree = ts.createSourceFile(file.source, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  let tests = 0;
  let expects = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(tree);
      if (/^(it|test)(\.(?:skip|fixme|todo))?(\.each\([\s\S]*\))?$/.test(callee) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) tests++;
      if (callee === 'expect') expects++;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(tests, file.testDeclarations, file.source);
  assert.equal(expects, file.expectExpressions, file.source);
  declarations += tests;
  expectations += expects;
}
assert.deepEqual({files:27, testDeclarations:declarations, expectExpressions:expectations}, manifest.sourceStaticTotals);
assert.equal(manifest.selectedWholeFamilies + manifest.deferredWholeFamilies, 27);
console.log(JSON.stringify({pin:manifest.pin, wholeFamilies:27, selectedWholeFamilies:manifest.selectedWholeFamilies, deferredWholeFamilies:manifest.deferredWholeFamilies, testDeclarations:declarations, expectExpressions:expectations, productTestsRun:0}));
