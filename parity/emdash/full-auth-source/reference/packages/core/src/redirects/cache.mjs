/**
 * Redirect rule cache.
 *
 * Worker-isolate cache for enabled redirect rules. The middleware populates
 * this on first request; route handlers invalidate it on writes. Cached rules
 * are revalidated after they expire so writes handled by another isolate
 * become visible here too.
 *
 * A cold isolate loads the rules from its source and waits for them. Once
 * warm, requests never wait: an expired cache keeps serving while one
 * background revalidation asks the source whether the loaded version is still
 * current and reloads only when it is not.
 *
 * This module deliberately has NO Astro imports so it can be safely imported
 * from handlers, seed, CLI, and tests without dragging in `astro:middleware`.
 */
import { after } from "../after.js";
import { createSingleFlightCache, invalidateSingleFlightCache, singleFlightCached, } from "../utils/single-flight-cache.js";
import { compilePattern, interpolateDestination, matchPattern, validatePattern, } from "./patterns.js";
const REDIRECT_CACHE_TTL_MS = 30_000;
const REDIRECT_CACHE_MAX_REFRESH_ATTEMPTS = 3;
const REDIRECT_CACHE_KEY = Symbol.for("emdash:redirect-cache");
const g = globalThis;
const cacheState = 
// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see request-context.ts)
g[REDIRECT_CACHE_KEY] ??
    (() => {
        const state = {
            redirects: null,
            expiresAt: 0,
            generation: 0,
            refresh: createSingleFlightCache(),
            revalidatingUntil: 0,
        };
        g[REDIRECT_CACHE_KEY] = state;
        return state;
    })();
/**
 * Invalidate the cached redirects (both exact and pattern).
 * Call when redirects are created, updated, or deleted.
 */
export function invalidateRedirectCache() {
    cacheState.generation++;
    cacheState.redirects = null;
    cacheState.expiresAt = 0;
    cacheState.revalidatingUntil = 0;
    invalidateSingleFlightCache(cacheState.refresh);
}
/** Compile a rule set into the in-memory lookup structures. */
function compileRedirects(rules) {
    const exact = new Map();
    for (const rule of rules.exact)
        exact.set(rule.source, rule);
    const patterns = [];
    for (const rule of rules.patterns) {
        const patternError = validatePattern(rule.source);
        if (patternError) {
            console.warn(`[emdash:redirects] Skipping redirect ${rule.id}: ${patternError}`);
            continue;
        }
        patterns.push({ redirect: rule, compiled: compilePattern(rule.source) });
    }
    return { version: rules.version, exact, patterns };
}
function installCachedRedirects(redirects) {
    cacheState.redirects = redirects;
    cacheState.expiresAt = Date.now() + REDIRECT_CACHE_TTL_MS;
    return cacheState.redirects;
}
function revalidateInBackground(source, cached) {
    const now = Date.now();
    if (cacheState.revalidatingUntil > now)
        return;
    cacheState.revalidatingUntil = now + REDIRECT_CACHE_TTL_MS;
    const generation = cacheState.generation;
    after(async () => {
        try {
            if (cached.version !== null && (await source.isCurrent(cached.version))) {
                if (generation === cacheState.generation) {
                    cacheState.expiresAt = Date.now() + REDIRECT_CACHE_TTL_MS;
                }
                return;
            }
            const loaded = compileRedirects(await source.load());
            if (generation === cacheState.generation)
                installCachedRedirects(loaded);
        }
        catch (error) {
            console.error("[emdash:redirects] revalidating redirects failed:", error);
        }
    });
}
export async function loadCachedRedirects(source) {
    for (let attempt = 0; attempt < REDIRECT_CACHE_MAX_REFRESH_ATTEMPTS; attempt++) {
        const cached = cacheState.redirects;
        if (cached) {
            if (Date.now() >= cacheState.expiresAt)
                revalidateInBackground(source, cached);
            return cached;
        }
        const generation = cacheState.generation;
        const loaded = await singleFlightCached(cacheState.refresh, async () => compileRedirects(await source.load()), { anchor: (promise) => after(() => promise), ownerTimeoutMs: 30_000 });
        if (generation === cacheState.generation) {
            return installCachedRedirects(loaded);
        }
        if (attempt === REDIRECT_CACHE_MAX_REFRESH_ATTEMPTS - 1) {
            return loaded;
        }
    }
    throw new Error("Redirect cache refresh exhausted without loading rules");
}
/**
 * Match a path against the cached pattern rules.
 * Returns the resolved destination and matching redirect, or null.
 */
export function matchCachedPatterns(rules, pathname) {
    for (const { redirect, compiled } of rules) {
        const params = matchPattern(compiled, pathname);
        if (params) {
            const dest = interpolateDestination(redirect.destination, params);
            return { redirect, destination: dest };
        }
    }
    return null;
}
