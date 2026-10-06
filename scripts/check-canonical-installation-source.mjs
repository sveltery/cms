import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import {restoreSeedNodeConstructors,assertSeedConstructorLedger} from './seed-node-constructor-transports.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const snapshot = resolve(root, 'parity/emdash/canonical-installation/source');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
assertSeedConstructorLedger('05fa10415d79d40d4bcbf14acc32f2e5800f1632b064523c74d9f8697c1336a5');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(resolve(root, path));
const inventory = JSON.parse(read('docs/canonical-installation-source.json'));
assert.equal(inventory.sourcePin, pin);
assert.equal(inventory.publicBase, '37d5ed93a553c6ddef86c50a0eb596acbc9da63b');
assert.equal(inventory.authorities.length, 38);
assert.equal(digest(JSON.stringify(inventory.authorities)), 'e302a96d754feffe1d6e6e11230c051a57696a37fefb77253d9494991c90b329');
for (const authority of inventory.authorities) {
  const bytes = readFileSync(resolve(snapshot, authority.path));
  assert.equal(bytes.length, authority.bytes, authority.path + ' complete length');
  assert.equal(digest(bytes), authority.sha256, authority.path + ' complete SHA256');
  const blob = createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  assert.equal(blob, authority.gitBlob, authority.path + ' pinned Git blob');
}
const licenseHash = 'd5ab82c0225b0def1fa140af22ff2f3bed9791a527545be1b04ab4337dc88675';
assert.equal(digest(readFileSync(resolve(snapshot, 'LICENSE'))), licenseHash);
assert.equal(digest(read('notices/emdash-MIT.txt')), licenseHash);

// Compare the ENTIRE Source and product text. Three original runtime copies
// differ only in imports/attribution. The taxonomy repository and definitions
// now have finite Native atomic-write adaptations, checked in full below.
function importsNormalized(body, path) {
  const file = ts.createSourceFile(path, body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(file.parseDiagnostics, [], path + ' parse');
  const ranges = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      ranges.push([node.moduleSpecifier.getStart(file), node.moduleSpecifier.end]);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      ranges.push([node.arguments[0].getStart(file), node.arguments[0].end]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  ranges.sort((a,b) => a[0]-b[0]);
  let position = 0;
  const normalized = ranges.map(([start,end],index) => {
    const text = body.slice(position,start) + JSON.stringify(`__source_import_${index}__`);
    position = end;
    return text;
  }).join('') + body.slice(position);
  return {normalized,imports:ranges.length};
}
const taxonomyAdaptationBytes = read('docs/taxonomy-canonical-repository-adaptations.json');
assert.equal(digest(taxonomyAdaptationBytes), '51ead6bb0e53e6aeb3e24fc31b4f5134c80c323eff7f9147f9c16ef82ef0c4c2',
  'complete finite taxonomy adaptation inventory');
const taxonomyAdaptation = JSON.parse(taxonomyAdaptationBytes);
assert.equal(taxonomyAdaptation.sourcePin, pin);
assert.equal(taxonomyAdaptation.runtimeAdaptations.length, 2);
assert.deepEqual(taxonomyAdaptation.runtimeAdaptations.map(value => value.edits.length), [28,4]);
function assertFiniteTaxonomyAdaptation(adaptation, product, reference, native, source) {
  assert.equal(adaptation.nativePath, native);
  assert.equal(adaptation.sourcePath, source);
  assert.equal(Buffer.byteLength(reference), adaptation.sourceBytes);
  assert.equal(digest(reference), adaptation.sourceSha256);
  const sourceLines = reference.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const expected = [];
  let position = 0;
  for (const edit of adaptation.edits) {
    const start = edit.sourceStartLine - 1;
    assert.ok(Number.isInteger(start) && start >= position && start <= sourceLines.length,
      'ordered, nonoverlapping Source adaptation range');
    assert.deepEqual(sourceLines.slice(start, start + edit.sourceLines.length), edit.sourceLines,
      'exact entire Source span at line ' + edit.sourceStartLine);
    expected.push(...sourceLines.slice(position, start), ...edit.nativeLines);
    position = start + edit.sourceLines.length;
  }
  expected.push(...sourceLines.slice(position));
  assert.equal(product, expected.join(''), native + ' complete explicitly adapted Native body');
  importsNormalized(product, native); // Retain the whole TypeScript parse check.
}
const runtime = [
  ['src/lib/server/options/repository.ts','packages/core/src/database/repositories/options.ts'],
  ['src/lib/server/options/conditional-storage.ts','packages/core/src/plugins/conditional-storage.ts'],
  ['src/lib/server/taxonomies/repository.ts','packages/core/src/database/repositories/taxonomy.ts'],
  ['src/lib/server/taxonomies/definitions.ts','packages/core/src/database/repositories/taxonomy-def.ts'],
  ['src/lib/server/taxonomies/slugify.ts','packages/admin/src/slugify.ts']
];
for (const [native,source] of runtime) {
  const text = read(native).toString();
  const lines = text.split('\n');
  assert.equal(lines[0], '// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.');
  assert.ok(lines[1].includes(pin + ':' + source), native + ' full Source attribution');
  const productBody = restoreSeedNodeConstructors(lines.slice(2).join('\n'),native);
  const referenceBody = readFileSync(resolve(snapshot,source),'utf8');
  const adaptation = taxonomyAdaptation.runtimeAdaptations.find(value => value.nativePath === native);
  if (adaptation) {
    assertFiniteTaxonomyAdaptation(adaptation,productBody,referenceBody,native,source);
    continue;
  }
  const product = importsNormalized(productBody,native);
  const reference = importsNormalized(referenceBody,source);
  assert.deepEqual(product,reference,native + ' entire import-adapted Source body');
}
const selected = 'packages/core/tests/integration/database/taxonomy-repository-pagination.test.ts';
const protectedFamilies = [
  'packages/core/tests/integration/database/options-repository.test.ts',
  'packages/core/tests/integration/database/plugin-storage-revisions-migration.test.ts',
  'packages/core/tests/utils/plugin-storage-revision-cases.ts'
];
const config = read('vitest.canonical-installation.config.ts').toString();
assert.ok(config.includes("include: ['parity/emdash/canonical-installation/source/" + selected + "']"));
for (const path of protectedFamilies) assert.equal(config.includes(path),false,path + ' remains unexecuted');
console.log('Canonical source guard:38 whole pinned authorities and MIT exact; Options exact constructor-only transport,2 whole import-adapted runtime bodies and2 whole finite Native atomic-adapted taxonomy bodies verified. Only the whole pagination2-callback/6-expression family selected. Protected whole families remain unexecuted. This byte check grants zero product/test parity or whole-module identity credit from constructor transport.');
