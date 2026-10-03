// Original real credential fixture. Assertion signing adapts EmDash 1.1.0
// packages/auth/src/passkey/authenticate.test.ts:64; no source declaration credit.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createAssertionSignatureMessage } from '@oslojs/webauthn';

function cbor(value: unknown): Buffer {
  function head(kind: number, size: number) {
    if (size < 24) return Buffer.from([(kind << 5) | size]);
    if (size < 256) return Buffer.from([(kind << 5) | 24, size]);
    const bytes = Buffer.alloc(3); bytes[0] = (kind << 5) | 25; bytes.writeUInt16BE(size, 1); return bytes;
  }
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -value - 1);
  if (typeof value === 'string') { const bytes = Buffer.from(value); return Buffer.concat([head(3, bytes.length), bytes]); }
  if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), Buffer.from(value)]);
  if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([key, entry]) => [cbor(key), cbor(entry)])]);
  throw new Error('Unsupported test CBOR value');
}
export function webauthnCredential(origin: string) {
  const rpId = new URL(origin).hostname;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x!, 'base64url'), y = Buffer.from(jwk.y!, 'base64url');
  const id = randomBytes(32), encodedId = id.toString('base64url');
  return {
    id: encodedId,
    registration(challenge: string) {
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const cose = new Map<number, number | Uint8Array>([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, y]]);
      const authData = Buffer.concat([createHash('sha256').update(rpId).digest(), Buffer.from([0x45]),
        Buffer.alloc(4), Buffer.alloc(16), length, id, cbor(cose)]);
      return { id: encodedId, rawId: encodedId, type: 'public-key' as const,
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin })).toString('base64url'),
          attestationObject: cbor(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]])).toString('base64url'),
          transports: ['internal'] as ('internal')[]
        } };
    },
    assertion(challenge: string, counter = 1, overrides: { origin?: string; rpId?: string; invalidSignature?: boolean } = {}) {
      const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: overrides.origin ?? origin }));
      const count = Buffer.alloc(4); count.writeUInt32BE(counter);
      const data = Buffer.concat([createHash('sha256').update(overrides.rpId ?? rpId).digest(), Buffer.from([0x05]), count]);
      const message = createAssertionSignatureMessage(data, client);
      const signature = sign('sha256', message, privateKey);
      if (overrides.invalidSignature) signature[signature.length - 1] ^= 1;
      return { id: encodedId, rawId: encodedId, type: 'public-key' as const,
        response: { clientDataJSON: client.toString('base64url'), authenticatorData: data.toString('base64url'), signature: signature.toString('base64url') } };
    }
  };
}
