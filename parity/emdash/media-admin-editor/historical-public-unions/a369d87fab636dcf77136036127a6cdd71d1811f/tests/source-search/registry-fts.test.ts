// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e blob 7e1413acd99071e888693021224a9644efa2a8c5; ONLY whole Search/FTS and rollback describe groups.
import { sql } from "kysely";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FTSManager } from "../../src/lib/server/search/fts-manager.ts";
import { setupTestDatabase, teardownTestDatabase, SchemaRegistry } from "../helpers/search-fixture.ts";
describe("registry source FTS groups", () => {
let db: Awaited<ReturnType<typeof setupTestDatabase>>;
let registry: SchemaRegistry;
beforeEach(async () => { db = await setupTestDatabase(); registry = new SchemaRegistry(db); });
afterEach(async () => { await teardownTestDatabase(db); });
	describe("Search (FTS) Integration", () => {
		let ftsManager: FTSManager;

		beforeEach(() => {
			ftsManager = new FTSManager(db);
		});

		it("does not auto-enable FTS when adding a searchable field", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});

			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});

			expect(await ftsManager.ftsTableExists("articles")).toBe(false);
		});

		it("does not auto-enable FTS when adding search support to a collection", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["drafts"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});

			expect(await ftsManager.ftsTableExists("articles")).toBe(false);

			await registry.updateCollection("articles", { supports: ["drafts", "search"] });

			expect(await ftsManager.ftsTableExists("articles")).toBe(false);
		});

		it("disables FTS when search support is removed from a collection", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			await ftsManager.enableSearch("articles");
			expect(await ftsManager.ftsTableExists("articles")).toBe(true);

			await registry.updateCollection("articles", { supports: ["drafts"] });

			expect(await ftsManager.ftsTableExists("articles")).toBe(false);
		});

		it("rebuilds FTS table to include a new searchable field when collection already has search enabled", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			await ftsManager.enableSearch("articles");
			expect(await ftsManager.ftsTableExists("articles")).toBe(true);

			await registry.createField("articles", {
				slug: "body",
				label: "Body",
				type: "text",
				searchable: true,
			});

			await expect(
				sql`SELECT body FROM "_cms_fts_articles" LIMIT 0`.execute(db),
			).resolves.toBeDefined();
		});

		it("deletes a searchable field from a search-enabled collection without error", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			await registry.createField("articles", {
				slug: "body",
				label: "Body",
				type: "text",
				searchable: true,
			});
			await ftsManager.enableSearch("articles");

			await expect(registry.deleteField("articles", "body")).resolves.toBeUndefined();

			expect(await ftsManager.ftsTableExists("articles")).toBe(true);
			await expect(
				sql`SELECT title FROM "_cms_fts_articles" LIMIT 0`.execute(db),
			).resolves.toBeDefined();
		});

		it("drops FTS table when deleting a search-enabled collection", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			await ftsManager.enableSearch("articles");
			expect(await ftsManager.ftsTableExists("articles")).toBe(true);

			await registry.deleteCollection("articles");

			expect(await ftsManager.ftsTableExists("articles")).toBe(false);
		});

		it("disables FTS when the last searchable field is deleted", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			await ftsManager.enableSearch("articles");
			expect(await ftsManager.ftsTableExists("articles")).toBe(true);

			await registry.deleteField("articles", "title");

			expect(await ftsManager.ftsTableExists("articles")).toBe(false);
		});

		it("does not create FTS table when collection supports search but has no searchable fields", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: false,
			});

			expect(await ftsManager.ftsTableExists("articles")).toBe(false);
		});

		it("preserves weights in config when search support is toggled off", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});

			await ftsManager.enableSearch("articles", { weights: { title: 10 } });
			const initialConfig = await ftsManager.getSearchConfig("articles");
			expect(initialConfig?.weights).toEqual({ title: 10 });

			await registry.updateCollection("articles", { supports: ["drafts"] });
			expect(await ftsManager.ftsTableExists("articles")).toBe(false);

			const finalConfig = await ftsManager.getSearchConfig("articles");
			expect(finalConfig?.weights).toEqual({ title: 10 });
		});
	});

	describe("atomicity: rollback on FTS sync failure", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("rolls back updateCollection when FTS disable fails", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			const ftsManager = new FTSManager(db);
			await ftsManager.enableSearch("articles");

			vi.spyOn(FTSManager.prototype, "disableSearch").mockRejectedValueOnce(
				new Error("FTS sync sabotaged"),
			);

			await expect(
				registry.updateCollection("articles", { supports: ["drafts"] }),
			).rejects.toThrow();

			const collection = await registry.getCollection("articles");
			expect(collection?.supports).toContain("search");
		});

		it("rolls back updateField when FTS rebuild fails", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			const ftsManager = new FTSManager(db);
			await ftsManager.enableSearch("articles");

			vi.spyOn(FTSManager.prototype, "disableSearch").mockRejectedValueOnce(
				new Error("FTS sync sabotaged"),
			);

			await expect(
				registry.updateField("articles", "title", { searchable: false }),
			).rejects.toThrow();

			const field = await registry.getField("articles", "title");
			expect(field?.searchable).toBe(true);
		});

		it("rolls back deleteField when FTS rebuild fails", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			await registry.createField("articles", {
				slug: "body",
				label: "Body",
				type: "text",
				searchable: true,
			});
			const ftsManager = new FTSManager(db);
			await ftsManager.enableSearch("articles");

			vi.spyOn(FTSManager.prototype, "rebuildIndex").mockRejectedValueOnce(
				new Error("FTS sync sabotaged"),
			);

			await expect(registry.deleteField("articles", "body")).rejects.toThrow();

			const field = await registry.getField("articles", "body");
			expect(field).not.toBeNull();
		});

		it("rolls back createField when FTS rebuild fails", async () => {
			await registry.createCollection({
				slug: "articles",
				label: "Articles",
				supports: ["search"],
			});
			await registry.createField("articles", {
				slug: "title",
				label: "Title",
				type: "string",
				searchable: true,
			});
			const ftsManager = new FTSManager(db);
			await ftsManager.enableSearch("articles");

			vi.spyOn(FTSManager.prototype, "rebuildIndex").mockRejectedValueOnce(
				new Error("FTS sync sabotaged"),
			);

			await expect(
				registry.createField("articles", {
					slug: "body",
					label: "Body",
					type: "text",
					searchable: true,
				}),
			).rejects.toThrow();

			const field = await registry.getField("articles", "body");
			expect(field).toBeNull();
		});
	});


});
