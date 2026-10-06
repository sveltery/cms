// EmDash 1.1.0 content handler hydration, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type {Kysely} from 'kysely';
import type {Database} from './database-types.ts';
import {BylineRepository} from './repository.ts';
import type {BylineSummary,ContentBylineCredit} from './repository-types.ts';
import type {ContentItem} from '../database/lifecycle/upstream/database/repositories/types.ts';

async function hydrateBylines(
	db: Kysely<Database>,
	collection: string,
	item: ContentItem,
): Promise<void> {
	const bylineRepo = new BylineRepository(db);
	// Strict per-locale (migration 040): a credit at locale X renders iff a
	// byline row exists at locale X in the credited translation_group. The
	// junction itself spans translations; rendering does not fall back.
	const localeOpt = item.locale ? { locale: item.locale } : undefined;
	const bylines = await bylineRepo.getContentBylines(collection, item.id, localeOpt);

	if (bylines.length > 0) {
		item.bylines = bylines.map((c) => ({ ...c, source: "explicit" as const }));
		item.byline = bylines[0]?.byline ?? null;
		return;
	}

	// `primaryBylineId` is set iff junction rows exist; non-null
	// suppresses author fallback even when the credit doesn't resolve
	// at this locale.
	if (item.primaryBylineId) {
		item.bylines = [];
		item.byline = null;
		return;
	}

	if (item.authorId) {
		// Same strict-locale rule as explicit credits: a user-linked byline
		// renders on the entry only when a sibling exists at the entry's
		// locale. Without this we'd silently surface the default-locale
		// row, which contradicts the per-locale model.
		const fallback = await bylineRepo.findByUserId(item.authorId, localeOpt);
		if (fallback) {
			item.bylines = [{ byline: fallback, sortOrder: 0, roleLabel: null, source: "inferred" }];
			item.byline = fallback;
			return;
		}
	}

	item.bylines = [];
	item.byline = null;
}

async function hydrateBylinesMany(
	db: Kysely<Database>,
	collection: string,
	items: ContentItem[],
): Promise<void> {
	if (items.length === 0) return;

	const bylineRepo = new BylineRepository(db);

	// 1. Bucket items by locale so we can call the strict-locale repo
	//    once per bucket. Items with a null/undefined locale (pre-i18n
	//    rows on a single-locale install) share an "unscoped" bucket.
	const localeBuckets = new Map<string | null, ContentItem[]>();
	for (const item of items) {
		const key = item.locale ?? null;
		const bucket = localeBuckets.get(key);
		if (bucket) bucket.push(item);
		else localeBuckets.set(key, [item]);
	}

	// 2. Per-locale: fetch explicit credits. Items whose credits don't
	//    resolve at this locale go through a locale-agnostic "has any
	//    junction" check before being considered for author inference —
	//    explicit editorial intent at any locale beats inferred fallback.
	const bylinesByItem = new Map<string, ContentBylineCredit[]>();
	const itemsNeedingAuthorCheck: ContentItem[] = [];
	for (const [locale, bucket] of localeBuckets) {
		const localeOpt = locale ? { locale } : undefined;
		const ids = bucket.map((i) => i.id);
		const credits = await bylineRepo.getContentBylinesMany(collection, ids, localeOpt);
		for (const [id, list] of credits) bylinesByItem.set(id, list);

		for (const item of bucket) {
			if (credits.has(item.id) && credits.get(item.id)!.length > 0) continue;
			if (item.authorId) itemsNeedingAuthorCheck.push(item);
		}
	}

	// 3. Author fallback applies only when no explicit credit exists
	//    (primaryBylineId null).
	const fallbackByItem = new Map<string, BylineSummary>();
	if (itemsNeedingAuthorCheck.length > 0) {
		const authorBuckets = new Map<string | null, ContentItem[]>();
		for (const item of itemsNeedingAuthorCheck) {
			if (item.primaryBylineId) continue;
			const key = item.locale ?? null;
			const bucket = authorBuckets.get(key);
			if (bucket) bucket.push(item);
			else authorBuckets.set(key, [item]);
		}

		for (const [locale, bucket] of authorBuckets) {
			const localeOpt = locale ? { locale } : undefined;
			const authorIds = bucket.map((i) => i.authorId).filter((id): id is string => id !== null);
			const uniqueAuthorIds = [...new Set(authorIds)];
			if (uniqueAuthorIds.length === 0) continue;
			const authorMap = await bylineRepo.findByUserIds(uniqueAuthorIds, localeOpt);
			for (const item of bucket) {
				if (!item.authorId) continue;
				const f = authorMap.get(item.authorId);
				if (f) fallbackByItem.set(item.id, f);
			}
		}
	}

	// 4. Assign to each item.
	for (const item of items) {
		const explicit = bylinesByItem.get(item.id);
		if (explicit && explicit.length > 0) {
			item.bylines = explicit.map((c) => ({ ...c, source: "explicit" as const }));
			item.byline = explicit[0]?.byline ?? null;
			continue;
		}

		const fallback = fallbackByItem.get(item.id);
		if (fallback) {
			item.bylines = [{ byline: fallback, sortOrder: 0, roleLabel: null, source: "inferred" }];
			item.byline = fallback;
			continue;
		}

		item.bylines = [];
		item.byline = null;
	}
}

export {hydrateBylines,hydrateBylinesMany};
