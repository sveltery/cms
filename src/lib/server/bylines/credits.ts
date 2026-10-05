// EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT; notices/emdash-MIT.txt.
// Complete Source bodies with native imports/storage hosting; docs/byline-backend.md.
import type { Kysely } from "kysely";

import { BylineRepository } from "./repository.ts";
import type { BylineSummary, ContentBylineCredit } from "./repository-types.ts";
import type { Database } from "./database-types.ts";
import { validateIdentifier } from "../menus/validate.ts";
import { isMissingTableError } from "../schema/db-errors.ts";

/**
 * Entry reference for batch byline lookups. Passing `authorId`,
 * `primaryBylineId`, and `locale` in directly avoids a per-entry
 * `SELECT` against the content table during hydration.
 *
 * `primaryBylineId` is the explicit-credit sentinel — non-null suppresses
 * author fallback. `locale` drives the strict per-locale join.
 */
export interface BylineEntry {
	id: string;
	authorId: string | null;
	primaryBylineId?: string | null;
	locale?: string | null;
}

export interface ResolveBylineCreditsOptions {
	/** Merge byline custom field values onto each credit. Defaults to `true`. */
	hydrateCustomFields?: boolean;
}

/**
 * Resolve byline credits for multiple content entries against an explicit
 * database handle.
 *
 * Entries are bucketed by `entry.locale` and each bucket gets a single
 * batched strict-locale credit query. Entries with no explicit credit fall
 * back to the byline linked to their author, unless `primaryBylineId` is set.
 * Items with no `locale` field (legacy / single-locale installs) share an
 * unscoped bucket.
 *
 * Every requested entry ID is present in the result, with `[]` when the
 * entry has no resolvable credit.
 */
export async function resolveBylineCredits(
	db: Kysely<Database>,
	collection: string,
	entries: BylineEntry[],
	options: ResolveBylineCreditsOptions = {},
): Promise<Map<string, ContentBylineCredit[]>> {
	validateIdentifier(collection, "collection");
	const hydrateCustomFields = options.hydrateCustomFields ?? true;
	const result = new Map<string, ContentBylineCredit[]>();

	for (const { id } of entries) {
		result.set(id, []);
	}

	if (entries.length === 0) {
		return result;
	}

	const repo = new BylineRepository(db);

	const buckets = new Map<string | null, BylineEntry[]>();
	for (const entry of entries) {
		const key = entry.locale ?? null;
		const bucket = buckets.get(key);
		if (bucket) bucket.push(entry);
		else buckets.set(key, [entry]);
	}

	// Each fetch skips hydration so the union of returned bylines can be
	// hydrated in a single batched pass below, keeping mixed-locale lists
	// at one translatable and one group-shared custom-field query.
	const explicitByEntry = new Map<string, ContentBylineCredit[]>();
	const entriesNeedingAuthorCheck: BylineEntry[] = [];
	const hydrationTargets: BylineSummary[] = [];
	for (const [locale, bucket] of buckets) {
		const localeOpt = locale ? { locale, skipHydration: true } : { skipHydration: true };
		const bucketIds = bucket.map((e) => e.id);
		let bylinesMap;
		try {
			bylinesMap = await repo.getContentBylinesMany(collection, bucketIds, localeOpt);
		} catch (error) {
			if (isMissingTableError(error)) return result;
			throw error;
		}
		for (const [id, list] of bylinesMap) {
			explicitByEntry.set(id, list);
			for (const credit of list) hydrationTargets.push(credit.byline);
		}

		for (const entry of bucket) {
			const hasResolved = bylinesMap.has(entry.id) && bylinesMap.get(entry.id)!.length > 0;
			if (hasResolved) continue;
			if (entry.authorId) entriesNeedingAuthorCheck.push(entry);
		}
	}

	const fallbackByEntry = new Map<string, BylineSummary>();
	if (entriesNeedingAuthorCheck.length > 0) {
		const authorBuckets = new Map<string | null, BylineEntry[]>();
		for (const entry of entriesNeedingAuthorCheck) {
			if (entry.primaryBylineId) continue;
			const key = entry.locale ?? null;
			const bucket = authorBuckets.get(key);
			if (bucket) bucket.push(entry);
			else authorBuckets.set(key, [entry]);
		}

		for (const [locale, bucket] of authorBuckets) {
			const localeOpt: { locale?: string; skipHydration: true } = locale
				? { locale, skipHydration: true }
				: { skipHydration: true };
			const authorIds = bucket.map((e) => e.authorId).filter((id): id is string => id !== null);
			const uniqueAuthorIds = [...new Set(authorIds)];
			if (uniqueAuthorIds.length === 0) continue;
			const authorBylineMap = await repo.findByUserIds(uniqueAuthorIds, localeOpt);
			for (const entry of bucket) {
				if (!entry.authorId) continue;
				const f = authorBylineMap.get(entry.authorId);
				if (f) {
					fallbackByEntry.set(entry.id, f);
					hydrationTargets.push(f);
				}
			}
		}
	}

	if (hydrateCustomFields && hydrationTargets.length > 0) {
		await repo.hydrateBylineCustomFields(hydrationTargets);
	}

	for (const { id } of entries) {
		const explicit = explicitByEntry.get(id);
		if (explicit && explicit.length > 0) {
			result.set(
				id,
				explicit.map((c) => ({ ...c, source: "explicit" as const })),
			);
			continue;
		}

		const fallback = fallbackByEntry.get(id);
		if (fallback) {
			result.set(id, [{ byline: fallback, sortOrder: 0, roleLabel: null, source: "inferred" }]);
		}
	}

	return result;
}
