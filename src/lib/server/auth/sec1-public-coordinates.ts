// Original Native SEC1 byte serializer; intentional source difference SEC1-01.
// Callers supply unsigned P-256 coordinates already decoded from 32-byte COSE fields.
export function encodeP256PublicCoordinates(x: bigint, y: bigint): Uint8Array {
  const limit = 1n << 256n;
  if (x < 0n || y < 0n || x >= limit || y >= limit) {
    throw new RangeError('P-256 public coordinates must fit in 32 unsigned bytes');
  }
  const bytes = new Uint8Array(65);
  bytes[0] = 0x04;
  for (let index = 0; index < 32; index++) {
    const shift = BigInt(index * 8);
    bytes[32 - index] = Number((x >> shift) & 0xffn);
    bytes[64 - index] = Number((y >> shift) & 0xffn);
  }
  return bytes;
}
