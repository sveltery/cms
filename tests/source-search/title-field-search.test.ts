// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob a97af4d2e2321640837ce5a31fde9bdd5a3a431d
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

/**
 * Search results should show the same title as the content list. When a
 * collection sets `titleField`, the result title comes from that field's
 * column, not the physical `title` column.
 */
describe("search: titleField drives the result title", () => {
	let db: Kysely<Database>;

	beforeEach(async () => {
		db = await setupTestDatabase();
		const registry = new SchemaRegistry(db);
		const fts = new FTSManager(db);

		await registry.createCollection({
			slug: "employees",
			label: "Employees",
			supports: ["search"],
		});
		await registry.createField("employees", {
			slug: "name",
			label: "Name",
			type: "string",
			searchable: true,
		});
		await registry.createField("employees", {
			slug: "title",
			label: "Job Title",
			type: "string",
			searchable: true,
		});
		await registry.updateCollection("employees", { titleField: "name" });
		await fts.enableSearch("employees");

		const repo = new ContentRepository(db);
		await repo.create({
			type: "employees",
			slug: "amy",
			status: "published",
			data: { name: "Amy Morse", title: "Commercial Lines Agent" },
		});
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it("returns the titleField value as the result title, not the title column", async () => {
		const res = await searchWithDb(db, "Amy");
		const hit = res.items.find((i) => i.collection === "employees");
		expect(hit?.title).toBe("Amy Morse");
		expect(hit?.title).not.toBe("Commercial Lines Agent");
	});
});
