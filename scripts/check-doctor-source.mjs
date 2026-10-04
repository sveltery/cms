import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const inventory = JSON.parse(readFileSync(root + 'docs/doctor-source.json', 'utf8'));
assert.equal(inventory.sourcePin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(inventory.authorities.length, 7);
for (const item of inventory.authorities) {
  const bytes = readFileSync(root + 'parity/emdash/doctor/source/' + item.path);
  assert.equal(bytes.length, item.bytes, item.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), item.gitBlob, item.path);
}
const license = readFileSync(root + 'parity/emdash/doctor/source/LICENSE');
assert.deepEqual(license, readFileSync(root + 'notices/emdash-MIT.txt'));
const path = inventory.sourceUnitWholeFile;
const source = ts.createSourceFile(path,
  readFileSync(root + 'parity/emdash/doctor/source/' + path, 'utf8'), ts.ScriptTarget.Latest, true);
assert.deepEqual(source.parseDiagnostics, []);
let declarations = 0, expectations = 0;
function visit(node) {
  if (ts.isCallExpression(node)) {
    if (node.expression.getText(source) === 'it') declarations++;
    if (node.expression.getText(source) === 'expect') expectations++;
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(declarations, inventory.sourceUnitDeclarations);
assert.equal(expectations, inventory.sourceExpectCalls);
console.log(JSON.stringify({wholeAuthorities: 7, sourceDeclarations: declarations, sourceExpectCalls: expectations,
  productTestsRun: 0, message: 'Immutable inventory verification grants no runtime parity credit.'}));
