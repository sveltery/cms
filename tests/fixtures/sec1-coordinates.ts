// Original Native byte-codec vectors. Synthetic values are not credentials.
// The final vector is the publicly specified NIST P-256 generator.
export const publicCoordinateCases = [
  ...[
    { label: 'zero', hex: '00' },
    { label: 'one-byte', hex: 'a5' },
    { label: '31-byte', hex: 'a5'.repeat(31) },
    { label: '32-byte', hex: 'a5'.repeat(32) },
  ].flatMap(x => [
    { label: 'zero', hex: '00' },
    { label: 'one-byte', hex: 'a5' },
    { label: '31-byte', hex: 'a5'.repeat(31) },
    { label: '32-byte', hex: 'a5'.repeat(32) },
  ].map(y => ({
    title: `x=${x.label}, y=${y.label}`,
    xHex: x.hex,
    yHex: y.hex,
    expectedHex: '04' + x.hex.padStart(64, '0') + y.hex.padStart(64, '0'),
  }))),
  {
    title: 'public NIST P-256 generator',
    xHex: '6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296',
    yHex: '4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5',
    expectedHex: '046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5',
  },
];
