import type { SessionPrincipal } from './roles.ts';
export interface SessionSnapshot { user: { id: string; role: number; disabled: boolean }; expiresAt: number }
/** Each read must observe session revocation and the current user record, never cookie roles. */
export interface SessionStore { read(hash: string): Promise<SessionSnapshot | null>; revoke(hash: string): Promise<void> }
export interface SessionReadOptions { timeoutMs?: number; keepAlive?: (task: Promise<void>) => void }
export async function resolveSessionUser<T>(session: { get(key: 'user'): Promise<T> } | undefined, timeoutMs = 3000, keepAlive?: (task: Promise<void>) => void): Promise<T | undefined> { return undefined; }
export async function resolvePrincipal(token: string | null | undefined, store: SessionStore | undefined, options: SessionReadOptions & { now?: () => number } = {}): Promise<SessionPrincipal | null> { return null; }
export async function hashSessionToken(token: string): Promise<string | null> { return null; }
export async function revokeSession(token: string | null | undefined, store: SessionStore): Promise<void> {}
