import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const manifestPath = 'parity/emdash/setup-wizard-source/manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const declarations = [];
for (const file of manifest.files) {
  const bytes = await readFile(file.path);
  assert.equal(bytes.byteLength, file.bytes, file.source);
  assert.equal(hash(bytes), file.sha256, file.source);
  if (process.argv[2] && process.argv[2] !== 'write') {
    assert.deepEqual(execFileSync('git', ['show', `${manifest.pin}:${file.source}`], { cwd: process.argv[2] }), bytes);
  }
  if (!file.kind.startsWith('whole-')) continue;
  const tree = ts.createSourceFile(file.source, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(tree);
      const title = node.arguments[0];
      if (/^(it|test)$/.test(callee) && title && ts.isStringLiteralLike(title)) {
        const expectations = [];
        function collect(child) {
          if (ts.isCallExpression(child) && /^(expect|expect\.element)$/.test(child.expression.getText(tree))) {
            let expression = child;
            while (expression.parent && (ts.isPropertyAccessExpression(expression.parent) || ts.isCallExpression(expression.parent) || ts.isElementAccessExpression(expression.parent))) expression = expression.parent;
            expectations.push({ line: tree.getLineAndCharacterOfPosition(child.getStart(tree)).line + 1, expression: expression.getText(tree), sha256: hash(expression.getText(tree)) });
          }
          ts.forEachChild(child, collect);
        }
        collect(node);
        declarations.push({ source: file.source, family: file.kind, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, title: title.text, sha256: hash(node.getText(tree)), expectations });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
assert.equal(declarations.filter(row => row.family === 'whole-component-test').length, 18);
assert.equal(declarations.filter(row => row.family === 'whole-e2e-test').length, 6);
if (process.argv[2] === 'write') {
  manifest.declarations = declarations;
  manifest.expectExpressions = declarations.reduce((sum, row) => sum + row.expectations.length, 0);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
} else {
  assert.deepEqual(declarations, manifest.declarations);
}
console.log(JSON.stringify({ pin: manifest.pin, frozenAuthorities: manifest.files.length, componentCases: 18, e2eCases: 6, expectExpressions: declarations.reduce((sum, row) => sum + row.expectations.length, 0), productTestsRun: 0 }));
