// Derived from EmDash 1.1.0, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT. See notices/emdash-MIT.txt.
import { type Kysely } from "kysely";

import { invalidateCollectionCache } from "../menus/object-cache.ts";
import { chunks, SQL_BATCH_SIZE } from "../menus/chunks.ts";
import type { Database } from "./types.ts";
import { NATIVE_SEO_STORAGE, seoStorage, type SeoStorage } from "./storage.ts";
import type { ContentSeo, ContentSeoInput } from "../../seo/types.ts";
import { seoUpsertStatements, seoDeleteStatements, seoCopyStatements } from "./content-write.ts";

/** Default SEO values for content without an explicit SEO row */
const SEO_DEFAULTS: ContentSeo = {
	title: null,
	description: null,
	image: null,
	canonical: null,
	noIndex: false,
};

/**
 * Repository for SEO metadata stored in `_cms_seo`.
 *
 * SEO data lives in a separate table keyed by (collection, content_id).
 * Only collections with `has_seo = 1` should use this — callers are
 * responsible for checking the flag before reading/writing.
 */
export class SeoRepository {
	private db: Kysely<Database>;
	private storage: SeoStorage;
	constructor(db: Kysely<Database>, storage: SeoStorage = NATIVE_SEO_STORAGE) {
		this.db = db; this.storage = seoStorage(storage);
	}

	/**
	 * Check whether a collection has SEO enabled (`has_seo = 1`).
	 * Returns `false` if the collection does not exist.
	 */
	async isEnabled(collection: string): Promise<boolean> {
		const row = await this.db
			.selectFrom(this.storage.collections)
			.select("has_seo")
			.where("slug", "=", collection)
			.executeTakeFirst();
		return row?.has_seo === 1;
	}

	/**
	 * Get SEO data for a content item. Returns null defaults if no row exists.
	 */
	async get(collection: string, contentId: string): Promise<ContentSeo> {
		const row = await this.db
			.selectFrom(this.storage.seo)
			.selectAll()
			.where("collection", "=", collection)
			.where("content_id", "=", contentId)
			.executeTakeFirst();

		if (!row) {
			return { ...SEO_DEFAULTS };
		}

		return {
			title: row.seo_title ?? null,
			description: row.seo_description ?? null,
			image: row.seo_image ?? null,
			canonical: row.seo_canonical ?? null,
			noIndex: row.seo_no_index === 1,
		};
	}

	/**
	 * Get SEO data for multiple content items.
	 * Returns a Map keyed by content_id. Items without SEO rows get defaults.
	 *
	 * Chunks the `content_id IN (…)` clause so the total bound-parameter count
	 * per statement (ids + the `collection = ?` filter) stays within Cloudflare
	 * D1's 100-variable limit regardless of how many content items are passed.
	 */
	async getMany(collection: string, contentIds: string[]): Promise<Map<string, ContentSeo>> {
		const result = new Map<string, ContentSeo>();

		if (contentIds.length === 0) return result;

		// Pre-fill with defaults so every input id has an entry even if no row exists.
		for (const id of contentIds) {
			result.set(id, { ...SEO_DEFAULTS });
		}

		const uniqueContentIds = [...new Set(contentIds)];
		for (const chunk of chunks(uniqueContentIds, SQL_BATCH_SIZE)) {
			const rows = await this.db
				.selectFrom(this.storage.seo)
				.selectAll()
				.where("collection", "=", collection)
				.where("content_id", "in", chunk)
				.execute();

			for (const row of rows) {
				result.set(row.content_id, {
					title: row.seo_title ?? null,
					description: row.seo_description ?? null,
					image: row.seo_image ?? null,
					canonical: row.seo_canonical ?? null,
					noIndex: row.seo_no_index === 1,
				});
			}
		}

		return result;
	}

	/**
	 * Upsert SEO data for a content item using INSERT ON CONFLICT DO UPDATE
	 * for atomicity. Skips no-op writes when input has no fields set.
	 */
	async upsert(collection: string, contentId: string, input: ContentSeoInput): Promise<ContentSeo> {
		const statements = seoUpsertStatements(this.db, collection, contentId, input, this.storage);
		if (!statements.length) return this.get(collection, contentId);
		await this.db.executeQuery(statements[0]);

		invalidateCollectionCache(collection);
		return this.get(collection, contentId);
	}

	/**
	 * Delete SEO data for a content item.
	 */
	async delete(collection: string, contentId: string): Promise<void> {
		await this.db.executeQuery(seoDeleteStatements(this.db, collection, contentId, this.storage)[0]);
		invalidateCollectionCache(collection);
	}

	/**
	 * Copy SEO data from one content item to another.
	 * Used by duplicate. Clears canonical (it pointed to the original).
	 */
	async copyForDuplicate(collection: string, sourceId: string, targetId: string): Promise<void> {
		const source = await this.get(collection, sourceId);

		const statements = seoCopyStatements(this.db, collection, targetId, source, this.storage);
		if (statements.length) {
			await this.db.executeQuery(statements[0]);
			invalidateCollectionCache(collection);
		}
	}
}
