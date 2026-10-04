import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeP256PublicCoordinates } from '../src/lib/server/auth/sec1-public-coordinates.ts';
import { publicCoordinateCases } from './fixtures/sec1-coordinates.ts';

for (const vector of publicCoordinateCases) {
  test('SEC1 uncompressed public-coordinate bytes: ' + vector.title, () => {
    const actual = encodeP256PublicCoordinates(BigInt('0x' + vector.xHex), BigInt('0x' + vector.yHex));
    assert.equal(actual.byteLength, 65);
    assert.equal(Buffer.from(actual).toString('hex'), vector.expectedHex);
  });
}
