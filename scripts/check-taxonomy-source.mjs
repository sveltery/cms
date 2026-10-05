// Immutable provenance guard only. This does not execute product or Source tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { withCompleteTaxonomyAssertions } from './taxonomy-source-catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/taxonomy-source.json'), 'utf8'));
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
assert.equal(manifest.immutableSource.commit, pin);
assert.equal(manifest.staticCounts.wholeFamilies, 27);
assert.equal(manifest.staticCounts.staticDeclarations, 310);
assert.equal(manifest.staticCounts.expectExpressions, 815);
assert.equal(manifest.sourceCatalogue.files.length, 27);
assert.equal(manifest.files.filter(file => file.role === 'whole-test-family').length, 27);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of manifest.files) {
  const bytes = readFileSync(resolve(root, file.path));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(hash(bytes), file.sha256, file.path);
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(blob, file.sourceGitBlob, file.path);
  assert.equal(blob, file.gitBlob, file.path);
}
for (const family of manifest.sourceCatalogue.files) {
  const file = manifest.files.find(value => value.sourcePath === family.path);
  assert.equal(file.role, 'whole-test-family', family.path);
  assert.equal(file.sha256, family.sourceSha256, family.path);
  assert.equal(file.sourceGitBlob, family.sourceBlob, family.path);
  for (const declaration of family.tests) assert.ok(declaration.sourceId.startsWith(`${pin}:${family.path}:`));
}
assert.equal(manifest.sourceCatalogue.files.reduce((n, family) => n + family.tests.length, 0), 310);
assert.equal(manifest.sourceCatalogue.files.reduce((n, family) => n + family.sharedAssertions.length + family.tests.reduce((m, declaration) => m + declaration.assertions.length, 0), 0), 815);
const derived = withCompleteTaxonomyAssertions(manifest.sourceCatalogue, sourcePath => {
  const file = manifest.files.find(value => value.sourcePath === sourcePath);
  assert.ok(file, sourcePath);
  return readFileSync(resolve(root, file.path));
});
assert.deepEqual(derived, manifest.sourceCatalogue, 'Complete immutable matcher AST inventory');
console.log(JSON.stringify({ wholeSourceFiles: manifest.files.length, wholeFamilies: 27, declarations: 310, expectExpressions: 815, productTestsRun: 0 }));
