import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const path = 'parity/emdash/dashboard-welcome-source/sources.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const declarations = [], files = [];
for (const source of manifest.authorities) {
  const bytes = await readFile(source.nativeAuthority);
  assert.equal(bytes.length, source.bytes, source.sourcePath);
  assert.equal(hash(bytes), source.sha256, source.sourcePath);
  assert.equal(execFileSync('git', ['hash-object', '--stdin'], { input: bytes }).toString().trim(), source.gitBlob);
  if (process.argv[2] && process.argv[2] !== 'write') {
    assert.deepEqual(execFileSync('git', ['show', `${manifest.sourcePin}:${source.sourcePath}`], { cwd: process.argv[2] }), bytes);
  }
  if (!source.sourcePath.includes('/tests/components/')) continue;
  const tree = ts.createSourceFile(source.sourcePath, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  function expectation(node) {
    if (!ts.isCallExpression(node) || !/^(expect|expect\.element)$/.test(node.expression.getText(tree))) return;
    let expression = node;
    while (expression.parent && (ts.isPropertyAccessExpression(expression.parent) || ts.isCallExpression(expression.parent) || ts.isElementAccessExpression(expression.parent))) expression = expression.parent;
    return { line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, expression: expression.getText(tree), sha256: hash(expression.getText(tree)) };
  }
  const wholeFileExpectations = [];
  function visit(node) {
    const row = expectation(node); if (row) wholeFileExpectations.push(row);
    if (ts.isCallExpression(node) && /^(it|test)$/.test(node.expression.getText(tree)) && ts.isStringLiteralLike(node.arguments[0])) {
      const expectations = [];
      function collect(child) { const row = expectation(child); if (row) expectations.push(row); ts.forEachChild(child, collect); }
      collect(node);
      declarations.push({ source: source.sourcePath, title: node.arguments[0].text,
        line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        sha256: hash(node.getText(tree)), expectations });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); files.push({ source: source.sourcePath, wholeFileExpectations });
}
assert.equal(declarations.filter(row => row.source.endsWith('Dashboard.test.tsx')).length, 24);
assert.equal(declarations.filter(row => row.source.endsWith('WelcomeModal.test.tsx')).length, 9);
assert.equal(files[0].wholeFileExpectations.length, 34);
assert.equal(files[1].wholeFileExpectations.length, 9);
if (process.argv[2] === 'write') {
  manifest.declarations = declarations; manifest.assertionFiles = files;
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
} else {
  assert.deepEqual(declarations, manifest.declarations); assert.deepEqual(files, manifest.assertionFiles);
}
console.log(JSON.stringify({ sourcePin: manifest.sourcePin, wholeSourceAuthorities: manifest.authorities.length,
  wholeSourceBytes: manifest.authorities.reduce((sum, row) => sum + row.bytes, 0), wholeCallbacks: declarations.length,
  wholeAssertionExpressions: files.reduce((sum, row) => sum + row.wholeFileExpectations.length, 0), productTestsRun: 0 }));
