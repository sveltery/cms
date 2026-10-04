// Immutable-file provenance guard. This does not run or qualify product tests.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('docs/canonical-feature-storage-source.json', root), 'utf8'));
assert.equal(manifest.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(manifest.version, '1.1.0');
assert.equal(manifest.files.length, 49);
assert.equal(manifest.files.filter(file => file.role === 'whole-test').length, 11);
assert.equal(new Set(manifest.files.map(file => file.vendoredPath)).size, manifest.files.length);
let bytes = 0;
for (const file of manifest.files) {
  assert.ok(file.vendoredPath.startsWith('parity/emdash/canonical-feature-storage-source/upstream/'));
  assert.ok(!file.vendoredPath.split('/').includes('..'));
  const actual = await readFile(new URL(file.vendoredPath, root));
  assert.equal(actual.length, file.bytes, file.sourcePath);
  assert.equal(createHash('sha256').update(actual).digest('hex'), file.sha256, file.sourcePath);
  bytes += actual.length;
}
const notice = await readFile(new URL(manifest.notice, root), 'utf8');
assert.ok(notice.includes('MIT License') && notice.includes('2026 Cloudflare'));
console.log(JSON.stringify({ pin: manifest.pin, wholeFiles: manifest.files.length, wholeTestFiles: 11,
  bytes, productTestsRun: 0, sourceCausalCredit: 0 }));
