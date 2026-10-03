// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 480297d8631853fe0ba655a884718de02dbfc0df
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete source callbacks; import and system namespace substitutions only.
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContentRepository } from "../helpers/search-fixture.ts";
import type { Database } from "../../src/lib/server/database/lifecycle/upstream/database/types.ts";
import { SchemaRegistry } from "../helpers/search-fixture.ts";
import { FTSManager } from "../../src/lib/server/search/fts-manager.ts";
import { searchWithDb } from "../../src/lib/server/search/query.ts";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/search-fixture.ts";

describe("FTS repair", () => {
	let db: Kysely<Database>;
	let registry: SchemaRegistry;
	let repo: ContentRepository;
	let ftsManager: FTSManager;
	let gameId: string;

	beforeEach(async () => {
		db = await setupTestDatabase();
		registry = new SchemaRegistry(db);
		repo = new ContentRepository(db);
		ftsManager = new FTSManager(db);

		await registry.createCollection({
			slug: "game",
			label: "Games",
			labelSingular: "Game",
			supports: ["search"],
		});
		await registry.createField("game", {
			slug: "title",
			label: "Title",
			type: "string",
			searchable: true,
		});
		await registry.createField("game", {
			slug: "blurb",
			label: "Blurb",
			type: "text",
			searchable: true,
		});

		const created = await repo.create({
			type: "game",
			slug: "trail-of-cthulhu",
			status: "published",
			publishedAt: new Date().toISOString(),
			data: {
				title: "Trail of Cthulhu",
				blurb: "Investigative horror in the Cthulhu mythos.",
			},
		});
		gameId = created.id;

		await ftsManager.enableSearch("game");
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it("recreates a missing FTS table when search remains enabled", async () => {
		expect(await ftsManager.ftsTableExists("game")).toBe(true);

		await ftsManager.dropFtsTable("game");

		expect(await ftsManager.ftsTableExists("game")).toBe(false);
		expect(
			await searchWithDb(db, "cthulhu", {
				collections: ["game"],
				status: "published",
			}),
		).toEqual({ items: [] });

		await expect(ftsManager.verifyAndRepairAll()).resolves.toBe(1);
		expect(await ftsManager.ftsTableExists("game")).toBe(true);

		const repaired = await searchWithDb(db, "cthulhu", {
			collections: ["game"],
			status: "published",
		});

		expect(repaired.items).toHaveLength(1);
		expect(repaired.items[0]?.slug).toBe("trail-of-cthulhu");
	});

	it("keeps the FTS index in sync after soft delete", async () => {
		await expect(repo.delete("game", gameId)).resolves.toBe(true);
		await expect(ftsManager.verifyAndRepairAll()).resolves.toBe(0);
	});
});
