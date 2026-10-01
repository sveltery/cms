// Resolver adapted from EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/session-user.ts
// Token hashing follows packages/auth/src/tokens.ts; see notices/emdash-MIT.txt.
import { decodeBase64urlIgnorePadding, encodeBase64urlNoPadding } from '@oslojs/encoding';
import { isRoleLevel, type SessionPrincipal } from './roles.ts';

export interface SessionSnapshot {
  user: { id: string; role: number; disabled: boolean };
  /** Unix epoch milliseconds, validated again after the store read settles. */
  expiresAt: number;
}
/** Each read must observe session revocation and the current user record, never cookie roles. */
export interface SessionStore {
  read(hash: string): Promise<SessionSnapshot | null>;
  revoke(hash: string): Promise<void>;
}
export interface SessionReadOptions {
  timeoutMs?: number;
  /** Pass the request's workerd waitUntil; never cache the task across requests. */
  keepAlive?: (task: Promise<void>) => void;
}
export const SESSION_GET_TIMEOUT_MS = 3000;

export async function resolveSessionUser<T>(
  session: { get(key: 'user'): Promise<T> } | undefined,
  timeoutMs = SESSION_GET_TIMEOUT_MS,
  keepAlive?: (task: Promise<void>) => void
): Promise<T | undefined> {
  if (!session || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;
  const read = Promise.resolve().then(() => session.get('user')).catch(() => undefined);
  try { keepAlive?.(read.then(() => undefined)); }
  catch { /* A missing lifetime extension can never grant authentication. */ }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => { timer = setTimeout(resolve, timeoutMs, undefined); });
  try { return await Promise.race([read, timeout]); }
  finally { clearTimeout(timer); }
}

function tokenBytes(token: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const bytes = decodeBase64urlIgnorePadding(token);
    return bytes.length === 32 && encodeBase64urlNoPadding(bytes) === token ? new Uint8Array(bytes) : null;
  } catch { return null; }
}

/** Same SHA-256/decoded-byte/base64url format as upstream, using standard Web Crypto. */
export async function hashSessionToken(token: string): Promise<string | null> {
  const bytes = tokenBytes(token);
  if (!bytes) return null;
  return encodeBase64urlNoPadding(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

export async function resolvePrincipal(
  token: string | null | undefined,
  store: SessionStore | undefined,
  options: SessionReadOptions & { now?: () => number } = {}
): Promise<SessionPrincipal | null> {
  if (!store || typeof token !== 'string' || !tokenBytes(token)) return null;
  const snapshot = await resolveSessionUser({ async get() {
    const hash = await hashSessionToken(token);
    return hash ? store.read(hash) : null;
  } }, options.timeoutMs, options.keepAlive);
  const now = (options.now ?? Date.now)();
  if (!snapshot || !Number.isFinite(now) || !Number.isFinite(snapshot.expiresAt) || snapshot.expiresAt <= now) return null;
  const user = snapshot.user;
  if (!user || typeof user.id !== 'string' || user.id.length === 0 || user.disabled !== false || !isRoleLevel(user.role)) return null;
  return Object.freeze({ id: user.id, role: user.role });
}

/** Await storage deletion before reporting logout; storage failures propagate. */
export async function revokeSession(token: string | null | undefined, store: SessionStore): Promise<void> {
  if (typeof token !== 'string') return;
  const hash = await hashSessionToken(token);
  if (hash) await store.revoke(hash);
}
