// Audits preserved source callback bodies, not runtime or complete parity.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const ledger = JSON.parse(readFileSync(new URL('../docs/native-editor-ports.json', import.meta.url), 'utf8'));
let expressions = 0;
for (const record of ledger.records) {
  const url = new URL(`../${record.localPath}`, import.meta.url);
  const ast = ts.createSourceFile(record.localPath, readFileSync(url, 'utf8'), ts.ScriptTarget.Latest, true);
  const matches = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      ['test', 'it'].includes(node.expression.text) && ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === record.title) {
      const callback = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
      if (callback?.body) matches.push(callback.body);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(matches.length, 1, `Expected one callback: ${record.title}`);
  const body = matches[0];
  assert.equal(createHash('sha256').update(body.getText(ast)).digest('hex'), record.bodySha256,
    `Source body changed: ${record.localPath}: ${record.title}`);
  let count = 0;
  function countExpectations(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'expect') count++;
    ts.forEachChild(node, countExpectations);
  }
  countExpectations(body);
  assert.equal(count, record.expectationLocations, `Source expectation count: ${record.title}`);
  expressions += count;
}
assert.equal(ledger.records.length, ledger.declarations);
assert.equal(expressions, ledger.expectationLocations);
console.log(`Preserved ${ledger.declarations} callback bodies and ${expressions} expectation locations; runtime evidence remains separate.`);
