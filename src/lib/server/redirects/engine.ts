// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/middleware/redirect.ts.
// Framework adaptation: explicit trusted database provider, response/cache hooks,
// request lifetime and optional database-owned cache. Rule/miss/catch body preserved.
import type { Kysely } from 'kysely';
import type { Database } from './database-types.ts';
import { RedirectRepository } from './repository.ts';
import { createRedirectSource } from './artifacts.ts';
import { loadCachedRedirects, matchCachedPatterns } from './cache.ts';
import { isSiteRelativeDestination } from './destination.ts';
import { isTerminalStatus } from './status.ts';

export interface RedirectContext {
 url: URL;
 request: Request;
 db?: Kysely<Database>;
 getDb(): Promise<Kysely<Database>>;
 redirect(location: string, status: 301 | 302 | 303 | 307 | 308): Response;
 cache?: { set(enabled: false): void };
 keepAlive?: (task: Promise<void>) => void;
 loadRedirects?: typeof loadCachedRedirects;
 createSource?: typeof createRedirectSource;
}

/** Paths that should never be intercepted by redirects */
const SKIP_PREFIXES = ["/_emdash", "/_image"];

/** Static asset extensions -- don't redirect file requests */
const ASSET_EXTENSION = /\.\w{1,10}$/;

type RedirectCode = 301 | 302 | 303 | 307 | 308;

function isRedirectCode(code: number): code is RedirectCode {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
}

function warnUnsafeDestination(id: string): void {
	console.warn(
		`[emdash:redirects] Skipping redirect ${id}: destination is not a site-relative path`,
	);
}

export async function runRedirectMiddleware(context: RedirectContext, next: () => Promise<Response>): Promise<Response> {
	const { pathname } = context.url;

	// Skip internal paths and static assets
	if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return next();
	}
	if (ASSET_EXTENSION.test(pathname)) {
		return next();
	}

	// Public visitors hit the runtime's anonymous fast path, which intentionally
	// omits `db` from `locals.emdash` to keep the public render boundary minimal
	// (issue #808). Fall back to `getDb()`, which transparently returns the
	// per-request scoped db (set in ALS by the runtime middleware) or the
	// singleton — same path the loader and template helpers use.
	let db = context.db;
	if (!db) {
		try {
			db = await context.getDb();
		} catch {
			return next();
		}
	}

	try {
		const repo = new RedirectRepository(db);

		// One query loads the published rules into the cache; warm requests
		// issue zero queries, and an expired cache checks the published version
		// in the background. Empty-redirect sites cache an empty Map + array.
		const cached = await (context.loadRedirects ?? loadCachedRedirects)((context.createSource ?? createRedirectSource)(db));

		// 1. Exact match (O(1) Map lookup)
		let exact = cached.exact.get(pathname);
		if (!exact && pathname.length > 1) {
			const alt = pathname.endsWith("/") ? pathname.slice(0, -1) : `${pathname}/`;
			exact = cached.exact.get(alt);
		}
		if (exact) {
			// Terminal statuses (410 Gone / 451): serve the status directly,
			// with no Location header.
			if (isTerminalStatus(exact.type)) {
				const hit = repo.recordHit(exact.id).catch(() => {});
				context.keepAlive?.(hit);
				return new Response(null, { status: exact.type });
			}
			const dest = exact.destination;
			if (!isSiteRelativeDestination(dest)) {
				warnUnsafeDestination(exact.id);
				return next();
			}
			const hit = repo.recordHit(exact.id).catch(() => {});
			context.keepAlive?.(hit);
			const code = isRedirectCode(exact.type) ? exact.type : 301;
			return context.redirect(dest, code);
		}

		// 2. Pattern match (compile once, match every request)
		const patternMatch = matchCachedPatterns(cached.patterns, pathname);
		if (patternMatch) {
			const { redirect, destination } = patternMatch;
			// Terminal statuses (410 Gone / 451): serve the status directly.
			if (isTerminalStatus(redirect.type)) {
				const hit = repo.recordHit(redirect.id).catch(() => {});
				context.keepAlive?.(hit);
				return new Response(null, { status: redirect.type });
			}
			if (!isSiteRelativeDestination(destination)) {
				warnUnsafeDestination(redirect.id);
				return next();
			}
			const hit = repo.recordHit(redirect.id).catch(() => {});
			context.keepAlive?.(hit);
			const code = isRedirectCode(redirect.type) ? redirect.type : 301;
			return context.redirect(destination, code);
		}

		// No redirect matched -- proceed and check for 404
		const response = await next();

		// Keep a 404 out of the route cache: publishing the missing entry later
		// purges content tags, not the missed path, so a cached 404 would outlive
		// the fix. Astro has no cache handle for URLs that match no route, but a
		// page answering a content miss with Astro.rewrite("/404") has one.
		if (response.status === 404) {
			const routeCache = context.cache;
			routeCache?.set(false);
		}

		// Log misses (fire-and-forget) under the path the visitor requested.
		// Two shapes count as a miss: a 404 response (an unmatched route, or a
		// page answering a content miss with Astro.rewrite("/404")), and a
		// matched route answering a content miss with a redirect to /404 —
		// there the missed path exists only on this first pass, before the
		// browser follows the redirect. The error page itself is never logged: /404
		// answers 404 by design and carries no path information.
		const location = response.headers.get("location");
		const missedByRedirect =
			isRedirectCode(response.status) && (location === "/404" || location === "/404/");
		const missedDirectly = response.status === 404 && pathname !== "/404" && pathname !== "/404/";
		if (missedDirectly || missedByRedirect) {
			const referrer = context.request.headers.get("referer") ?? null;
			const userAgent = context.request.headers.get("user-agent") ?? null;
			const write = repo
				.log404({
					path: pathname,
					referrer,
					userAgent,
				})
				.catch(() => {});
			context.keepAlive?.(write);
		}

		return response;
	} catch {
		// If the redirects table doesn't exist yet (pre-migration), skip silently
		return next();
	}
}
