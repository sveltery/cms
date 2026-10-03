// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 96aeeebf85f5e13c20bd37c7d63042d16281074a
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete source callbacks; import and system namespace substitutions only.
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContentRepository } from "../helpers/search-fixture.ts";
import type { Database } from "../../src/lib/server/database/lifecycle/upstream/database/types.ts";
import { SchemaRegistry } from "../helpers/search-fixture.ts";
import { FTSManager } from "../../src/lib/server/search/fts-manager.ts";
import { getSuggestions } from "../../src/lib/server/search/query.ts";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/search-fixture.ts";

/**
 * Autocomplete should stay consistent with search results. A collection
 * with a configured `titleField` and no literal `title` field must still
 * produce suggestions, drawing the suggestion title from that field's column.
 */
describe("getSuggestions: titleField drives the suggestion title", () => {
	let db: Kysely<Database>;

	beforeEach(async () => {
		db = await setupTestDatabase();
		const registry = new SchemaRegistry(db);
		const fts = new FTSManager(db);

		// No `title` field at all -- only a custom titleField. Before the fix this
		// collection was skipped entirely (getSuggestions required a literal title).
		await registry.createCollection({
			slug: "employees",
			label: "Employees",
			supports: ["search"],
		});
		await registry.createField("employees", {
			slug: "full_name",
			label: "Full name",
			type: "string",
			searchable: true,
		});
		await registry.updateCollection("employees", { titleField: "full_name" });
		await fts.enableSearch("employees");

		const repo = new ContentRepository(db);
		await repo.create({
			type: "employees",
			slug: "jane-doe",
			status: "published",
			data: { full_name: "Jane Doe" },
		});
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it("suggests the entry and uses the titleField value as the title", async () => {
		const suggestions = await getSuggestions(db, "jane", { collections: ["employees"] });
		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({
			collection: "employees",
			slug: "jane-doe",
			title: "Jane Doe",
		});
	});
});
