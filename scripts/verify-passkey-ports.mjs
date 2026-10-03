// Verify copied fixtures, immutable source identities and executable assertion maps.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import ts from 'typescript';

const checkout = process.argv[2];
if (!checkout) throw new Error('Usage: node scripts/verify-passkey-ports.mjs PINNED_SOURCE_CHECKOUT');
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('docs/passkey-ports.json', root), 'utf8'));
const git = (...args) => execFileSync('git', ['-C', resolve(checkout), ...args]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(git('rev-parse', 'HEAD').toString().trim(), ledger.pin);
function expressions(text, name) {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = [], expectations = [], typeExpectations = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (/^it(?:\.|\(|$)/.test(callee) && node.arguments.some(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) {
        declarations.push({ line, title: node.arguments[0].getText(source) });
      }
      if (ts.isPropertyAccessExpression(node.expression) && /^expect(?:\(|\.)/.test(callee)) expectations.push({ line, text: node.getText(source) });
      if (ts.isPropertyAccessExpression(node.expression) && /^expectTypeOf\(/.test(callee)) typeExpectations.push({ line, text: node.getText(source) });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { declarations, expectations, typeExpectations };
}
let declarations = 0, expectations = 0, typeExpectations = 0;
for (const selection of ledger.algorithmSelections) {
  const original = git('show', `${ledger.pin}:${selection.source}`).toString();
  const local = await readFile(new URL(selection.local, root), 'utf8');
  assert.equal(git('rev-parse', `${ledger.pin}:${selection.source}`).toString().trim(), selection.blob);
  assert.equal(sha256(original), selection.sourceSha256);
  assert.equal(sha256(local), selection.localSha256);
  const expected = original.replace(/"\.\/([^"\n]+)\.js"/g, '"../../../src/lib/server/auth/vendor/passkey/$1.ts"')
    .replace(/"\.\.\/types\.js"/g, '"../../../src/lib/server/auth/vendor/types.ts"');
  assert.equal(local.split('\n').slice(3).join('\n'), expected, `Fixture/assertion changed: ${selection.local}`);
  const sourceAst = expressions(original, selection.source), localAst = expressions(local, selection.local);
  assert.deepEqual(sourceAst.declarations, selection.declarations.map(({ line, title }) => ({ line, title })));
  assert.deepEqual(sourceAst.expectations, selection.runtimeExpectationExpressions.map(({ line, text }) => ({ line, text })));
  assert.deepEqual(localAst.declarations, selection.declarations.map(({ localLine, title }) => ({ line: localLine, title })));
  assert.deepEqual(localAst.expectations, selection.runtimeExpectationExpressions.map(({ localLine, text }) => ({ line: localLine, text })));
  assert.deepEqual(localAst.typeExpectations.map(({ text }) => text), sourceAst.typeExpectations.map(({ text }) => text));
  declarations += sourceAst.declarations.length; expectations += sourceAst.expectations.length; typeExpectations += sourceAst.typeExpectations.length;
}
assert.equal(declarations, ledger.algorithmTotals.completeRuntimeDeclarations);
assert.equal(expectations, ledger.algorithmTotals.runtimeExpectationExpressionLocations);
assert.equal(typeExpectations, ledger.algorithmTotals.typeExpectationLocations);
console.log(JSON.stringify({ pin: ledger.pin, copiedFiles: ledger.algorithmSelections.length, declarations, expectations, typeExpectations,
  fullFixtureBytesVerified: true, routeAndSupplementalCredit: 0 }));
