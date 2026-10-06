// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete named Source URL-pattern cache and invalidation declarations.
import { resetRegisteredCollectionsCache } from '../schema/collection-slugs-state.ts';
import { invalidateSchemaObjectCache } from '../menus/object-cache.ts';

interface CachedPattern {
	slug: string;
	regex: RegExp;
	paramNames: string[];
}

interface UrlPatternCache {
	patterns: CachedPattern[] | null;
}

const URL_PATTERN_CACHE_KEY = Symbol.for("emdash:url-pattern-cache");

const queryGlobal = globalThis as Record<symbol, unknown>;

const urlPatternCache: UrlPatternCache =
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see request-context.ts)
	(queryGlobal[URL_PATTERN_CACHE_KEY] as UrlPatternCache | undefined) ??
	(() => {
		const cache: UrlPatternCache = { patterns: null };
		queryGlobal[URL_PATTERN_CACHE_KEY] = cache;
		return cache;
	})();

export function invalidateUrlPatternCache(): void {
	urlPatternCache.patterns = null;
	resetRegisteredCollectionsCache();
	invalidateSchemaObjectCache();
}
