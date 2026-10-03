// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 8d5a61d2eaefd4b4a257bf329253beea37ebb7bd
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete source callbacks; import and system namespace substitutions only.
import type { Kysely } from "kysely";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { ContentRepository } from "../helpers/search-fixture.ts";
import type { Database } from "../../src/lib/server/database/lifecycle/upstream/database/types.ts";
import { setI18nConfig } from "../../../src/i18n/config.js";
import { SchemaRegistry } from "../helpers/search-fixture.ts";
import { FTSManager } from "../../src/lib/server/search/fts-manager.ts";
import { getSuggestions, searchWithDb } from "../../src/lib/server/search/query.ts";
import { createPostFixture } from "../helpers/search-fixture.ts";
import { setupTestDatabaseWithCollections, teardownTestDatabase } from "../helpers/search-fixture.ts";

describe("getSuggestions (Integration)", () => {
	let db: Kysely<Database>;
	let repo: ContentRepository;

	beforeEach(async () => {
		db = await setupTestDatabaseWithCollections();
		repo = new ContentRepository(db);

		const registry = new SchemaRegistry(db);
		const ftsManager = new FTSManager(db);
		await registry.updateField("post", "title", { searchable: true });
		await ftsManager.enableSearch("post");

		await repo.create(
			createPostFixture({
				slug: "designing-things",
				status: "published",
				data: { title: "Designing things" },
			}),
		);
	});

	afterEach(async () => {
		setI18nConfig(null);
		await teardownTestDatabase(db);
	});

	it("returns matching suggestions for a plain prefix query", async () => {
		const suggestions = await getSuggestions(db, "des", {
			collections: ["post"],
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({
			collection: "post",
			slug: "designing-things",
			title: "Designing things",
		});
	});

	it("does not return draft content", async () => {
		await repo.create(
			createPostFixture({
				slug: "designing-secret-things",
				status: "draft",
				data: { title: "Designing secret things" },
			}),
		);

		const suggestions = await getSuggestions(db, "des", {
			collections: ["post"],
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]?.title).toBe("Designing things");
	});

	it("returns empty array for a non-matching query", async () => {
		const suggestions = await getSuggestions(db, "zzz", {
			collections: ["post"],
		});

		expect(suggestions).toEqual([]);
	});

	it("searches using the configured locale casing", async () => {
		setI18nConfig({ defaultLocale: "en", locales: ["en", "zh-TW"] });
		await repo.create(
			createPostFixture({
				slug: "taiwan-design",
				status: "published",
				locale: "zh-TW",
				data: { title: "Taiwan design" },
			}),
		);

		const results = await searchWithDb(db, "Taiwan", {
			collections: ["post"],
			locale: "zh-tw",
		});

		expect(results.items.map((item) => item.slug)).toEqual(["taiwan-design"]);
	});

	it("suggests using the configured locale casing", async () => {
		setI18nConfig({ defaultLocale: "en", locales: ["en", "zh-TW"] });
		await repo.create(
			createPostFixture({
				slug: "taiwan-design",
				status: "published",
				locale: "zh-TW",
				data: { title: "Taiwan design" },
			}),
		);

		const suggestions = await getSuggestions(db, "Tai", {
			collections: ["post"],
			locale: "zh-tw",
		});

		expect(suggestions.map((suggestion) => suggestion.slug)).toEqual(["taiwan-design"]);
	});
});
