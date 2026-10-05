// Whole pinned Source loader taxonomy-names cache; imported request/database owners only.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { Kysely } from "kysely";
import type { Database } from "./database-types.ts";
import { selectTaxonomyDefs } from "./definitions.ts";
import { getRequestContext } from "../menus/context.ts";
import { isMissingTableError, isMissingColumnError } from "../database/lifecycle/upstream/utils/db-errors.ts";

export async function getDb(): Promise<Kysely<Database>> {
  const db = getRequestContext()?.db;
  if (!db) throw new Error("Taxonomy database is unavailable outside a configured request");
  return db as unknown as Kysely<Database>;
}

/**
 * Cache for taxonomy names by collection (only used for the primary database).
 * Stored on globalThis so Vite SSR chunk duplication cannot create independent
 * caches. Skipped when a per-request DB override is active (e.g. preview mode)
 * because the override DB may have different taxonomies.
 */
interface TaxonomyNamesHolder {
	cache: Map<string, Set<string>> | null;
}

const TAXONOMY_NAMES_CACHE_KEY = Symbol.for("emdash:taxonomy-names");
const taxonomyNamesStore = globalThis as Record<symbol, unknown>;
const taxonomyNamesHolder: TaxonomyNamesHolder =
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see taxonomies/index.ts)
	(taxonomyNamesStore[TAXONOMY_NAMES_CACHE_KEY] as TaxonomyNamesHolder | undefined) ??
	(() => {
		const holder: TaxonomyNamesHolder = { cache: null };
		taxonomyNamesStore[TAXONOMY_NAMES_CACHE_KEY] = holder;
		return holder;
	})();

function setTaxonomyNamesCache(cache: Map<string, Set<string>> | null): void {
	taxonomyNamesHolder.cache = cache;
}

/**
 * Get taxonomy names attached to a collection (cached for the primary DB,
 * bypassed only when the per-request DB is an isolated instance — playground /
 * DO preview). Plain D1 Sessions routing shares schema with the singleton, so
 * the isolate-wide cache stays valid.
 */
export async function getTaxonomyNames(db: Kysely<Database>, collection: string): Promise<Set<string>> {
	const hasIsolatedDb = getRequestContext()?.dbIsIsolated === true;

	if (!hasIsolatedDb && taxonomyNamesHolder.cache) {
		return taxonomyNamesHolder.cache.get(collection) ?? new Set();
	}

	try {
		const defs = await selectTaxonomyDefs(db).execute();
		const namesByCollection = new Map<string, Set<string>>();
		for (const def of defs) {
			let collections: unknown;
			try {
				collections = JSON.parse(def.collections ?? "[]");
			} catch {
				continue;
			}
			if (!Array.isArray(collections)) continue;
			for (const attachedCollection of collections) {
				if (typeof attachedCollection !== "string") continue;
				const names = namesByCollection.get(attachedCollection) ?? new Set<string>();
				names.add(def.name);
				namesByCollection.set(attachedCollection, names);
			}
		}
		if (!hasIsolatedDb) {
			setTaxonomyNamesCache(namesByCollection);
		}
		return namesByCollection.get(collection) ?? new Set();
	} catch (error) {
		if (!isMissingTableError(error) && !isMissingColumnError(error)) throw error;

		const empty = new Set<string>();
		if (!hasIsolatedDb) {
			setTaxonomyNamesCache(new Map());
		}
		return empty;
	}
}

/**
 * Reset the isolate-wide taxonomy-names cache.
 *
 * Called from `invalidateTaxonomyDefsCache()` so that creating or seeding a
 * taxonomy definition is reflected within the current isolate instead of
 * waiting for the isolate to recycle. Keeps this cache consistent with the
 * isolate-wide taxonomy-defs cache in `taxonomies/index.ts`.
 */
export function resetTaxonomyNamesCache(): void {
	setTaxonomyNamesCache(null);
}
