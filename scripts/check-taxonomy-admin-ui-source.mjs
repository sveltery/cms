// Provenance/AST validation only. This does not execute product tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const ledger = JSON.parse(readFileSync(new URL('../docs/taxonomy-admin-ui-source.json', import.meta.url), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
assert.equal(ts.version, '6.0.3');
for (const entry of ledger.files) {
  const bytes = readFileSync(new URL(`../${entry.path}`, import.meta.url));
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(hash(bytes), entry.sha256, entry.path);
  assert.equal(gitBlob(bytes), entry.sourceGitBlob, entry.path);
}

function receiverRoot(node) {
  while (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) node = node.expression;
  return node;
}
function isAssertion(node) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) return false;
  const receiver = receiverRoot(node.expression);
  if (ts.isCallExpression(receiver)) {
    const root = receiverRoot(receiver.expression);
    if (ts.isIdentifier(root) && root.text === 'expect') return true;
  }
  return ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'expect' &&
    ['assertions', 'hasAssertions', 'unreachable', 'fail'].includes(node.expression.name.text);
}

let declarations = 0, assertions = 0, sharedAssertions = 0;
for (const family of ledger.sourceCatalogue.files) {
  const stored = ledger.files.find(file => file.sourcePath === family.path);
  assert.ok(stored, family.path);
  const text = readFileSync(new URL(`../${stored.path}`, import.meta.url), 'utf8');
  const file = ts.createSourceFile(family.path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(file.parseDiagnostics.length, 0, family.path);
  const lineOf = node => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  const calls = new Map();
  const actualAssertions = [];
  function walk(node) {
    if (ts.isCallExpression(node)) {
      if (node.arguments.some(arg => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) calls.set(lineOf(node), node);
      if (isAssertion(node)) {
        const exact = ts.isAwaitExpression(node.parent) ? node.parent : node;
        actualAssertions.push({ line: lineOf(exact), expression: exact.getText(file) });
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(file);
  const retained = [...family.tests.flatMap(test => test.assertions), ...family.sharedAssertions]
    .map(({ line, expression }) => ({ line, expression })).sort((a, b) => a.line - b.line);
  assert.deepEqual(actualAssertions.sort((a, b) => a.line - b.line), retained, family.path);
  for (const test of family.tests) {
    const registration = calls.get(test.line);
    assert.ok(registration, test.sourceId);
    assert.equal(hash(registration.getText(file)), test.registrationSha256, test.sourceId);
    assert.equal(test.registration, 'it', test.sourceId);
    assert.deepEqual(test.expansion, [], test.sourceId);
  }
  declarations += family.tests.length;
  assertions += actualAssertions.length;
  sharedAssertions += family.sharedAssertions.length;
}
assert.deepEqual([declarations, assertions, sharedAssertions], [79, 245, 2]);
const sourceRender = readFileSync(new URL('../parity/emdash/taxonomy-admin-ui/source/packages/admin/tests/utils/render.tsx', import.meta.url), 'utf8');
const wholeProviders = sourceRender.slice(sourceRender.indexOf('type RenderWrapper'), sourceRender.indexOf('\nexport const render'));
const nativeRender = readFileSync(new URL('../tests/helpers/taxonomy-admin-ui/dom-render.tsx', import.meta.url), 'utf8');
assert.ok(nativeRender.includes(wholeProviders), 'Whole original provider declarations');
assert.equal(nativeRender, sourceRender, 'Whole original Source render transport');
const originalSetup = readFileSync(new URL('../parity/emdash/taxonomy-admin-ui/source/packages/admin/tests/setup.ts', import.meta.url), 'utf8');
assert.equal(readFileSync(new URL('../tests/helpers/taxonomy-admin-ui/dom-setup.ts', import.meta.url), 'utf8'), originalSetup, 'Whole original Source setup');
console.log(JSON.stringify({ wholeSourceFamilies: 4, sourceDeclarations: declarations, sourceMatcherExpressions: assertions,
  sharedSourceMatcherExpressions: sharedAssertions, sourceExpandedCases: declarations, sourceFilesVerified: ledger.files.length,
  productTestsRun: 0, sourceParityCredit: 0 }));
