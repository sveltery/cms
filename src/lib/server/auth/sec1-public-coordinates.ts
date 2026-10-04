// Baseline forwarding adapter: preserve the pinned dependency before the byte-codec repair.
import { ECDSAPublicKey, p256 } from '@oslojs/crypto/ecdsa';

export function encodeP256PublicCoordinates(x: bigint, y: bigint): Uint8Array {
  return new ECDSAPublicKey(p256, x, y).encodeSEC1Uncompressed();
}
