// Native inventory tooling. Parse immutable Source expressions without executing tests or product code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';

function receiverRoot(node) {
  while (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) node = node.expression;
  return node;
}

function isExpectCall(node) {
  if (!ts.isCallExpression(node)) return false;
  const root = receiverRoot(node.expression);
  return ts.isIdentifier(root) && root.text === 'expect';
}

function isAssertion(node) {
  if (!ts.isCallExpression(node)) return false;
  // A matcher owns its chained expect/element/poll call; the inner call is not a second assertion.
  if (ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) return false;
  const receiver = receiverRoot(node.expression);
  if (ts.isCallExpression(receiver) && isExpectCall(receiver)) return true;
  return ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'expect' &&
    ['assertions', 'hasAssertions', 'unreachable', 'fail'].includes(node.expression.name.text);
}

/** Retain every existing declaration/property; derive all exact matcher expressions from AST receivers. */
export function withCompleteTaxonomyAssertions(catalogue, readSource) {
  assert.equal(ts.version, '6.0.3');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  return {
    ...catalogue,
    files: catalogue.files.map(family => {
      const bytes = readSource(family.path);
      assert.equal(hash(bytes), family.sourceSha256, family.path);
      const text = bytes.toString('utf8');
      const file = ts.createSourceFile(family.path, text, ts.ScriptTarget.Latest, true,
        family.path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      assert.equal(file.parseDiagnostics.length, 0, family.path);
      const lineOf = node => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      const callbacks = new Map();
      function declarations(node) {
        if (ts.isCallExpression(node)) {
          const callback = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
          if (callback) callbacks.set(lineOf(node), { node, callback });
        }
        ts.forEachChild(node, declarations);
      }
      declarations(file);
      function assertionsIn(root) {
        const assertions = [];
        function walk(node) {
          if (isAssertion(node)) {
            const exact = ts.isAwaitExpression(node.parent) ? node.parent : node;
            const line = lineOf(exact);
            assertions.push({ line, expression: exact.getText(file),
              sourceUrl: `https://github.com/emdash-cms/emdash/blob/${catalogue.commit}/${family.path}#L${line}` });
          }
          ts.forEachChild(node, walk);
        }
        walk(root);
        return assertions;
      }
      const owned = new Set();
      const key = expression => `${expression.line}:${expression.expression}`;
      const tests = family.tests.map(declaration => {
        const registration = callbacks.get(declaration.line);
        assert.ok(registration, declaration.sourceId);
        assert.equal(hash(registration.node.getText(file)), declaration.registrationSha256, declaration.sourceId);
        const assertions = assertionsIn(registration.callback.body);
        const actual = new Set(assertions.map(key));
        for (const retained of declaration.assertions) assert.ok(actual.has(key(retained)), `Removed Source assertion ${declaration.sourceId}`);
        for (const expression of assertions) owned.add(key(expression));
        return { ...declaration, assertions };
      });
      const sharedAssertions = assertionsIn(file).filter(expression => !owned.has(key(expression)));
      const actualShared = new Set(sharedAssertions.map(key));
      for (const retained of family.sharedAssertions) assert.ok(actualShared.has(key(retained)), `Removed shared assertion ${family.path}:${retained.line}`);
      return { ...family, tests, sharedAssertions };
    })
  };
}
