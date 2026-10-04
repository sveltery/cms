import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = JSON.parse(read('docs/block-registry-source.json'));
assert.equal(inventory.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(inventory.records.length, 50);
assert.equal(digest(JSON.stringify(inventory.records)), 'f3bd3d3561d7730aa64142be571ad9787738dffa714d7d952f09e667cbf64479');
assert.equal(new Set(inventory.records.map(record => record.destination)).size, 50);
let completeBytes = 0;
for (const record of inventory.records) {
  const bytes = read(record.destination);
  assert.equal(bytes.length, record.bytes, record.source + ' complete length');
  assert.equal(digest(bytes), record.sha256, record.source + ' complete SHA256');
  const blob = createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  assert.equal(blob, record.sourceGitBlob, record.source + ' pinned Git blob');
  completeBytes += bytes.length;
}
assert.equal(completeBytes, 606359);
assert.equal(inventory.authorityCount, 50);
assert.equal(inventory.authorityBytes, completeBytes);
const licenseHash = 'd5ab82c0225b0def1fa140af22ff2f3bed9791a527545be1b04ab4337dc88675';
assert.equal(digest(read('notices/emdash-MIT.txt')), licenseHash);
assert.equal(digest(read('parity/emdash/block-registry-source/authority/LICENSE.txt')), licenseHash);

let declarations = 0, expectations = 0;
for (const source of inventory.familiesInitiallyOwned) {
  const reference = read('parity/emdash/block-registry-source/authority/' + source + '.txt');
  const executable = read('parity/emdash/block-registry-source/executable/' + source);
  assert.deepEqual(executable, reference, source + ' ENTIRE executable test body unchanged');
  const file = ts.createSourceFile(source, reference.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(file.parseDiagnostics, [], source + ' parse');
  const foundDeclarations = [], foundExpectations = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (['it','test'].includes(node.expression.text)) foundDeclarations.push(node.getText(file));
      if (node.expression.text === 'expect') {
        let outer = node;
        while (outer.parent && ((ts.isPropertyAccessExpression(outer.parent) && outer.parent.expression === outer) ||
          (ts.isCallExpression(outer.parent) && outer.parent.expression === outer))) outer = outer.parent;
        foundExpectations.push(outer.getText(file));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  const row = inventory.testInventory.find(entry => entry.source === source);
  assert.ok(row?.owned, source + ' whole owned family');
  assert.deepEqual(foundDeclarations, row.declarations.map(entry => entry.expression), source + ' whole declarations/datasets');
  assert.deepEqual(foundExpectations, row.expressions.map(entry => entry.expression), source + ' every expect expression');
  assert.equal(foundDeclarations.length, row.testDeclarations);
  assert.equal(foundExpectations.length, row.expectExpressions);
  declarations += foundDeclarations.length; expectations += foundExpectations.length;
}
assert.equal(inventory.familiesInitiallyOwned.length, 4);
assert.equal(declarations, 19); assert.equal(expectations, 58);
assert.equal(inventory.ownedDeclarations, declarations);
assert.equal(inventory.ownedExpectExpressions, expectations);
const resetPath = 'packages/core/tests/workerd/d1-schema.ts';
assert.deepEqual(read('parity/emdash/block-registry-source/executable/' + resetPath),
  read('parity/emdash/block-registry-source/authority/' + resetPath + '.txt'), 'whole Source reset/catalogue helper unchanged');
assert.equal(digest(read('vitest.block-registry-source.config.ts')),
  '9029eda0323ecb8cee448ef372f77e8fa55f138f424709424329fed7aed0a434',
  'qualified entire Node/default/globals and original D1 30000ms fixture config');
console.log('Block source guard:50 whole pinned authorities/606359 bytes, MIT, original4 whole test bodies/19 declarations/58 expects and reset helper exact. Deadlines/config qualified. Static fidelity only; zero new behavior credit.');
