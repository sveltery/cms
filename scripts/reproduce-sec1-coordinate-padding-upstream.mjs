// Offline public-coordinate byte reproduction only: no authentication or key generation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { ECDSAPublicKey, p256 } from '@oslojs/crypto/ecdsa';
import { publicCoordinateCases } from '../tests/fixtures/sec1-coordinates.ts';

const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/reproduce-sec1-coordinate-padding-upstream.mjs PINNED_SOURCE_CHECKOUT');
const readSource = path => execFileSync('git', ['-C', source, 'show', pin + ':' + path]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256(readSource('packages/auth/src/passkey/register.ts')), '645c228570be61abf98a1cf24d1e342f0eee9ccfc31c8f859d644886528f8434');
const lock = readSource('pnpm-lock.yaml').toString();
assert.ok(lock.includes("'@oslojs/crypto@1.0.1':\n    resolution: {integrity: sha512-7n08G8nWjAr/Yu3vu9zzrd0L9XnrJfpMioQcvCMxBIiF5orECHe5/3J0jmXRVvgfqMm/+4oxlQ+Sq39COYLcNQ==}"));
assert.ok(lock.includes("'@oslojs/binary@1.0.0':\n    resolution: {integrity: sha512-9RCU6OwXU6p67H4NODbuxv2S3eenuQ4/WFLrsq+K/k682xrznH5EVWA7N4VFk9VYVcbFtKqur5YQQZc0ySGhsQ==}"));
const require = createRequire(import.meta.url);
const ecdsaDirectory = dirname(require.resolve('@oslojs/crypto/ecdsa'));
assert.equal(sha256(readFileSync(resolve(ecdsaDirectory, 'ecdsa.js'))), '840479ed5f7987c08e0831f79bca48ce72ff0031b989f4cdb42229d7bffdeb31');
const cryptoRequire = createRequire(require.resolve('@oslojs/crypto/ecdsa'));
assert.equal(sha256(readFileSync(resolve(dirname(cryptoRequire.resolve('@oslojs/binary')), 'big.js'))), 'b657109c467be9a8e7b83ba60bba4e4a08bafd6fc3d2888433c4c990771865f9');

const cases = publicCoordinateCases.map(vector => {
  const actual = new ECDSAPublicKey(p256, BigInt('0x' + vector.xHex), BigInt('0x' + vector.yHex)).encodeSEC1Uncompressed();
  assert.equal(actual.byteLength, 65);
  const actualHex = Buffer.from(actual).toString('hex');
  const observedSourceHex = '04' + vector.xHex.padStart(64, '0') + vector.yHex.padEnd(64, '0');
  assert.equal(actualHex, observedSourceHex);
  return { title: vector.title, expectedHex: vector.expectedHex, actualHex, matchesFixedWidthEncoding: actualHex === vector.expectedHex };
});
assert.equal(cases.length, 17);
assert.equal(cases.filter(vector => !vector.matchesFixedWidthEncoding).length, 8);
console.log(JSON.stringify({ pin, sourceDependency: '@oslojs/crypto@1.0.1', cases, mismatches: 8,
  authFunctionsCalled: 0, sourceDeclarationsExecuted: 0, sourceParityCredit: 0 }, null, 2));
