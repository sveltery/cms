// Ported from EmDash 1.1.0 repositories/types.ts and utils/base64.ts at
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright 2026 Cloudflare Inc.
// MIT; see notices/emdash-MIT.txt. Error code is local envelope metadata only.
const MAX_CURSOR_LENGTH = 4096;
const hasNative = typeof Uint8Array.prototype.toBase64 === 'function' &&
  typeof Uint8Array.fromBase64 === 'function';

function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  if (hasNative) return bytes.toBase64();
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function decodeBase64(base64: string): string {
  if (hasNative) return new TextDecoder().decode(Uint8Array.fromBase64(base64));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
export function encodeCursor(orderValue: string, id: string): string {
  return encodeBase64(JSON.stringify({ orderValue, id }));
}
export class InvalidCursorError extends Error {
  readonly code = 'INVALID_CURSOR';
  constructor(cursor: string) {
    const display = cursor.length > 50 ? `${cursor.slice(0, 47)}...` : cursor;
    super(`Invalid pagination cursor: ${display}`);
    this.name = 'InvalidCursorError';
  }
}
export function decodeCursor(cursor: string): { orderValue: string; id: string } {
  if (!cursor) throw new InvalidCursorError(cursor);
  if (cursor.length > MAX_CURSOR_LENGTH) throw new InvalidCursorError(cursor);
  let parsed: unknown;
  try { parsed = JSON.parse(decodeBase64(cursor)); }
  catch { throw new InvalidCursorError(cursor); }
  if (parsed === null || typeof parsed !== 'object') throw new InvalidCursorError(cursor);
  const candidate = parsed as { orderValue?: unknown; id?: unknown };
  if (typeof candidate.orderValue !== 'string' || typeof candidate.id !== 'string') throw new InvalidCursorError(cursor);
  return { orderValue: candidate.orderValue, id: candidate.id };
}
