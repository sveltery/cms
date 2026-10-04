import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const inventory = JSON.parse(readFileSync(root + 'docs/doctor-source.json', 'utf8'));
assert.equal(inventory.sourcePin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(inventory.authorities.length, 7);
assert.equal(createHash('sha256').update(JSON.stringify(inventory.authorities)).digest('hex'), '297095e8f8c27230604e9defe62eda785081bcc5ab46710870d76cbdc4257a11');
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

// The whole datetime scanner remains Source code after finite import/namespace adaptations.
let scanner = readFileSync(root + 'parity/emdash/doctor/source/packages/core/src/database/datetime-storage.ts', 'utf8');
for (const [before, after] of [
  ['"../datetime-normalization.js"', '"../database/lifecycle/upstream/datetime-normalization.ts"'],
  ['"./types.js"', '"./types.ts"'], ['"./validate.js"', '"../database/lifecycle/upstream/database/validate.ts"'],
  ['"_emdash_collections"', '"_cms_collections"'], ['"_emdash_fields as field"', '"_cms_fields as field"'],
  ['"_emdash_collections as collection"', '"_cms_collections as collection"'],
  ['"options"', '"_cms_options"'], ['"revisions"', '"_cms_revisions"'], ['`revisions/', '`_cms_revisions/']
]) scanner = scanner.replaceAll(before, after);
const header = '// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.\n' +
  '// Whole EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/database/datetime-storage.ts; namespace/import adaptations only.\n';
assert.equal(readFileSync(root + 'src/lib/server/diagnostics/datetime-storage.ts', 'utf8'), header + scanner);
