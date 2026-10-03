// Provenance evidence only. This checker executes no product behavior.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const upstream = process.argv[2];
if (!upstream) throw new Error('Usage: node scripts/check-lifecycle-source-ports.mjs /path/to/emdash');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const ports = JSON.parse(readFileSync('docs/lifecycle-ports.json', 'utf8'));
const implementation = JSON.parse(readFileSync('docs/lifecycle-source-files.json', 'utf8'));
assert.equal(ports.pin, pin);
assert.equal(implementation.pin, pin);
const authority = new Map();
function source(path, expectedBlob) {
  if (!authority.has(path)) {
    const blob = execFileSync('git', ['-C', upstream, 'rev-parse', `${pin}:${path}`], { encoding: 'utf8' }).trim();
    const text = execFileSync('git', ['-C', upstream, 'show', `${pin}:${path}`], { encoding: 'utf8' });
    authority.set(path, { blob, text });
  }
  const value = authority.get(path);
  if (expectedBlob) assert.equal(value.blob, expectedBlob, `Authority blob changed: ${path}`);
  return value.text;
}
function declarations(text, path) {
  const parsed = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const values = new Set();
  function visit(node) {
    if (ts.isExpressionStatement(node)) values.add(node.getText(parsed));
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return values;
}

const groups = [
  ['declarations', 'tests/lifecycle-upstream.test.ts', 22],
  ['normalizationDeclarations', 'tests/lifecycle-normalization-upstream.test.ts', 4],
  ['publicationPermissionDeclarations', 'tests/production/lifecycle-publish-permissions-upstream.test.ts', 3]
];
let completeDeclarations = 0;
for (const [group, localPath, count] of groups) {
  const local = declarations(readFileSync(localPath, 'utf8'), localPath);
  assert.equal(ports[group].length, count, `Declaration inventory changed: ${group}`);
  for (const entry of ports[group]) {
    assert.equal(entry.pin, pin);
    const original = declarations(source(entry.path, entry.blob), entry.path);
    assert.ok(original.has(entry.sourceDeclaration), `Source callback mismatch: ${entry.path}: ${entry.title}`);
    assert.ok(local.has(entry.sourceDeclaration), `Executable callback mismatch: ${localPath}: ${entry.title}`);
    completeDeclarations++;
  }
}

let copiedSourceHashes = 0;
let hostSubstitutions = 0;
for (const entry of implementation.files) {
  const original = source(entry.path, entry.blob);
  if (entry.hostSubstitution) {
    hostSubstitutions++;
    continue;
  }
  assert.equal(createHash('sha256').update(original).digest('hex'), entry.sourceSHA256, `Source hash mismatch: ${entry.path}`);
  const local = readFileSync(entry.localPath, 'utf8');
  assert.ok(local.includes(pin) && local.includes(entry.blob), `Missing source identity: ${entry.localPath}`);
  assert.ok(local.includes('MIT') && local.includes('Cloudflare Inc.'), `Missing source attribution: ${entry.localPath}`);
  copiedSourceHashes++;
}
assert.equal(copiedSourceHashes, 19);
assert.equal(hostSubstitutions, 7);
console.log(JSON.stringify({ completeDeclarations, copiedSourceHashes, hostSubstitutions,
  verifiedAuthorityBlobs: authority.size, localImplementationTransformationsChecked: false, productTestsRun: 0 }));
