// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Pinned source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; see docs/cloudflare-runtime-ports.json.
import type { D1Database } from '@cloudflare/workers-types';
import { Kysely } from 'kysely';
import { CoalescingD1Dialect } from '../database/coalescing-d1.ts';
import { SessionD1Dialect, type RawBindingD1Adapter } from '../database/d1.ts';
import { createD1SessionGuard, type D1SessionGuard } from '../database/d1-session-guard.ts';
import type { CmsDatabase, CmsTables } from '../database/contract.ts';

export interface D1Config { binding: string; session?: 'disabled' | 'auto' | 'primary-first'; bookmarkCookie?: string; coalesce?: boolean }
interface CookieJar { get(name: string): { value: string } | undefined; set(name: string, value: string, options: Record<string, unknown>): void }
export interface RequestScopedDbOpts { config: D1Config; binding?: D1Database; isAuthenticated: boolean; endedAuthenticated?: () => boolean; isWrite: boolean; cookies: CookieJar; url: URL }
export interface RequestScopedDb { db: Kysely<CmsTables>; database: CmsDatabase; commit(): void }
const DEFAULT_BOOKMARK_COOKIE = '__em_d1_bookmark';
let warnedCoalesceNoRuntimeSession = false;
const SESSION_GUARD_KEY = Symbol.for("emdash:d1-session-guard");

function getSessionGuard(): D1SessionGuard {
	const g = globalThis as Record<symbol, unknown>;
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see do-sql.ts)
	let guard = g[SESSION_GUARD_KEY] as D1SessionGuard | undefined;
	if (!guard) {
		guard = createD1SessionGuard();
		g[SESSION_GUARD_KEY] = guard;
	}
	return guard;
}

/**
 * D1 bookmarks are opaque, minted by Cloudflare. We don't validate the shape
 * (a tighter regex risks rejecting a format change and silently degrading
 * read-your-writes), but we do cap length and reject control characters so a
 * malicious or corrupt cookie can't smuggle anything weird into `withSession`.
 */
// D1 bookmarks observed in the wild are ~60 chars, but the format is opaque
// and future encodings (e.g. signed envelopes) could be longer. Err on the
// generous side — cookie values max out at ~4 KB anyway.
const MAX_BOOKMARK_LENGTH = 1024;

function hasControlChars(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code < 0x20 || code === 0x7f) return true;
	}
	return false;
}

export function createRequestScopedDb(opts: RequestScopedDbOpts): RequestScopedDb | null {
	if (!isSessionEnabled(opts.config)) return null;
	// A session query hung earlier in this isolate's life (see the guard).
	// Sessions are considered broken here; route everything through the
	// singleton (direct binding) instead of hanging every request.
	const sessionGuard = getSessionGuard();
	if (sessionGuard.isBroken()) return null;
	const binding = opts.binding;
	if (!binding || typeof binding.withSession !== "function") {
		// Sessions are enabled in config, so createDialect's config-time warning
		// didn't fire — but the live binding can't actually do sessions (older
		// D1 binding / missing withSession). Coalescing silently falls back to
		// the singleton, so surface that once rather than leaving the opt-in a
		// mystery no-op.
		if (opts.config.coalesce && binding && !warnedCoalesceNoRuntimeSession) {
			warnedCoalesceNoRuntimeSession = true;
			console.warn(
				"[emdash] d1({ coalesce: true }) has no effect: the D1 binding does not support sessions (withSession() is unavailable at runtime). Query coalescing requires D1 sessions.",
			);
		}
		return null;
	}

	const cookieName = opts.config.bookmarkCookie ?? DEFAULT_BOOKMARK_COOKIE;
	const configConstraint =
		opts.config.session === "primary-first" ? "first-primary" : "first-unconstrained";

	// Any write — authenticated or not (e.g. an anonymous comment POST) — must
	// hit primary; we don't want a write plus a follow-up read racing across
	// replicas. Authenticated reads resume from a prior bookmark when the client
	// sent a valid one. Everything else (anonymous reads — the whole point of
	// read replicas) uses the config default, typically "first-unconstrained"
	// for nearest-replica routing.
	let constraint: string = configConstraint;
	if (opts.isWrite) {
		constraint = "first-primary";
	} else if (opts.isAuthenticated) {
		const bookmark = opts.cookies.get(cookieName)?.value;
		if (
			bookmark &&
			bookmark.length > 0 &&
			bookmark.length <= MAX_BOOKMARK_LENGTH &&
			!hasControlChars(bookmark)
		) {
			constraint = bookmark;
		}
	}

	const session = binding.withSession(constraint);
	// kysely-d1 only touches .prepare() and .batch() on the database argument,
	// both of which D1DatabaseSession implements. Hang-guarded: until the
	// first session query settles in this isolate, queries are raced against
	// a timeout and fall back to the direct binding if the Sessions API never
	// responds (issue #1273).
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- session is structurally compatible with the subset D1Dialect uses
	const sessionAsDatabase = sessionGuard.wrap(session as unknown as D1Database, binding);
	// Coalescing is per-request only by construction: this Kysely (and its
	// driver buffer) lives for a single request, so there is no cross-request
	// buffering. The shared singleton from createDialect must never coalesce.
	const dialect = opts.config.coalesce
		? new CoalescingD1Dialect({ database: sessionAsDatabase })
		: new SessionD1Dialect({ database: sessionAsDatabase });
	const db = new Kysely<any>({
		dialect,
	});

	const adapter = dialect.createAdapter() as RawBindingD1Adapter;
	const database: CmsDatabase = {
		db,
		atomicBatch: queries => db.connection().execute(() => adapter.executeAtomicBatch(queries)),
		close: () => db.destroy()
	};
	return {
		db, database,
		commit() {
			// Anonymous sessions can't resume across requests, so there's no
			// value in persisting a bookmark for them. A request that became
			// authenticated mid-flight (login, signup, invite) must persist:
			// its writes landed on the primary, and the follow-up request reads
			// authenticated — without this bookmark it can hit a replica that
			// doesn't have the new user/session rows yet.
			if (!opts.isAuthenticated && !opts.endedAuthenticated?.()) return;
			const newBookmark = session.getBookmark?.();
			if (!newBookmark) return;
			opts.cookies.set(cookieName, newBookmark, {
				path: "/",
				httpOnly: true,
				sameSite: "lax",
				secure: opts.url.protocol === "https:",
			});
		},
	};
}

function isSessionEnabled(config: D1Config): boolean {
	return !!config.session && config.session !== "disabled";
}
