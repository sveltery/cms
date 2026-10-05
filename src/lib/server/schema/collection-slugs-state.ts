// EmDash913cb1 collection-slugs-cache holder/reset, separated Native module.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Sole same globalSymbol holder; no request-context or backend dependency.
interface SlugsHolder {
	promise: Promise<Set<string>> | null;
	/** When the cached promise was created; gates bounded revalidation. */
	fetchedAt: number;
}

const HOLDER_KEY = Symbol.for("emdash:collection-slugs");
const g = globalThis as Record<symbol, unknown>;
export const collectionSlugsHolder: SlugsHolder =
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see request-cache.ts)
	(g[HOLDER_KEY] as SlugsHolder | undefined) ??
	(() => {
		const h: SlugsHolder = { promise: null, fetchedAt: 0 };
		g[HOLDER_KEY] = h;
		return h;
	})();

export function resetRegisteredCollectionsCache(): void {
	collectionSlugsHolder.promise = null;
	collectionSlugsHolder.fetchedAt = 0;
}
