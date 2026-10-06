import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import {restoreSeedNodeConstructors,assertSeedConstructorLedger} from './seed-node-constructor-transports.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = JSON.parse(read('docs/source-seed-backend-inventory.json'));
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
assertSeedConstructorLedger('e48f0db1771df1c1ea2b828d9d61dbf17b6fe441ea57d1f326b6a2d79ea7618b');
assert.equal(inventory.sourcePin, pin);
assert.equal(inventory.publicBase, 'aa6d942a9a5167a0bb656750880fdeeee134a218');
assert.equal(inventory.authorities.length, 78);
assert.equal(inventory.testFamilies.length, 35);
const snapshot = 'parity/emdash/source-seed-backend/source/';
for (const file of inventory.authorities) {
  const bytes = read(snapshot + file.path);
  assert.equal(bytes.length, file.bytes, file.path + ' entire length');
  assert.equal(digest(bytes), file.sha256, file.path + ' entire SHA256');
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'), file.gitBlob, file.path + ' pinned blob');
}
assert.equal(digest(read(snapshot + 'LICENSE')), digest(read('notices/emdash-MIT.txt')));

function normalizeImports(text, path) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(file.parseDiagnostics, [], path + ' parses');
  const ranges = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) ranges.push([node.moduleSpecifier.getStart(file), node.moduleSpecifier.end]);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) ranges.push([node.arguments[0].getStart(file), node.arguments[0].end]);
    ts.forEachChild(node, visit);
  }
  visit(file);
  let cursor = 0;
  return ranges.sort((a, b) => a[0] - b[0]).map(([start, end], index) => {
    const part = text.slice(cursor, start) + JSON.stringify(`__source_import_${index}__`);
    cursor = end;
    return part;
  }).join('') + text.slice(cursor);
}
for (const { native, source } of inventory.runtime) {
  const lines = read(native).toString().split('\n');
  assert.equal(lines[0], '// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.');
  assert.equal(lines[1], '// Source ' + pin + ':' + source + '; complete import-adapted body.');
  assert.equal(normalizeImports(restoreSeedNodeConstructors(lines.slice(2).join('\n'), native), native), normalizeImports(read(snapshot + source).toString(), source), native + ' complete Source body after exact listed constructor reversal');
}
for (const { native, source, declarations } of inventory.extractedRuntime ?? []) {
  function selected(text, path) {
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.deepEqual(file.parseDiagnostics, []);
    return declarations.map(name => {
      const matches = file.statements.filter(node => node.name?.text === name);
      assert.equal(matches.length, 1, path + ':' + name);
      return matches[0].getText(file);
    });
  }
  assert.deepEqual(selected(restoreSeedNodeConstructors(read(native).toString(), native), native), selected(read(snapshot + source).toString(), source), native + ' entire named Source declarations after exact listed constructor reversal');
}
for (const { native, source, declarations } of inventory.extractedNestedRuntime ?? []) {
  function selected(text, path) {
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.deepEqual(file.parseDiagnostics, []);
    return declarations.map(name => {
      const matches = [];
      function visit(node) {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(file) === name)) matches.push(node);
        ts.forEachChild(node, visit);
      }
      visit(file);
      assert.equal(matches.length, 1, path + ':' + name);
      return matches[0].getText(file);
    });
  }
  assert.deepEqual(selected(read(native).toString(), native), selected(read(snapshot + source).toString(), source), native + ' entire named nested Source declarations');
}
console.log('Source seed guard:78 complete authorities and35 whole test families pinned; MIT retained. Only exact listed constructor spans are reversed before complete body comparisons; zero whole-module identity, execution/parity credit from those transports.');
