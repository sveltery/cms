// Original Native SEC1 byte serializer; intentional source difference SEC1-01.
// Callers supply unsigned P-256 coordinates already decoded from 32-byte COSE fields.
function writeCoordinate(bytes: Uint8Array, start: number, value: bigint): void {
  for (let index = 31; index >= 0; index--) {
    bytes[start + index] = Number(value & 0xffn);
    value >>= 8n;
  }
}

export function encodeP256PublicCoordinates(x: bigint, y: bigint): Uint8Array {
  const limit = 1n << 256n;
  if (x < 0n || y < 0n || x >= limit || y >= limit) {
    throw new RangeError('P-256 public coordinates must fit in 32 unsigned bytes');
  }
  const bytes = new Uint8Array(65);
  bytes[0] = 0x04;
  writeCoordinate(bytes, 1, x);
  writeCoordinate(bytes, 33, y);
  return bytes;
}
