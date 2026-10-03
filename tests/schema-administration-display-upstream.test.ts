// Complete pinned collection-title-date-fields.test.ts declarations, imports/setup only adapted.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 1.1.0 pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
import { Kysely } from 'kysely';
import { describe, beforeEach, afterEach } from 'node:test';
import { it, expect } from './helpers/upstream-expect.ts';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import type { CmsTables } from '../src/lib/server/database/contract.ts';
import { CmsError as SchemaError } from '../src/lib/server/database/contract.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
describe("collection titleField/dateField", () => {
	let database: ReturnType<typeof openSqlite>;
	let db: Kysely<CmsTables>;
	let registry: SchemaRegistry;

	beforeEach(async () => {
		database = openSqlite(":memory:"); db = database.db;
		await migrateCms(database); registry = new SchemaRegistry(database);

		await registry.createCollection({
			slug: "employees",
			label: "Employees",
			supports: ["drafts"],
		});
		await registry.createField("employees", { slug: "name", label: "Name", type: "string" });
		await registry.createField("employees", { slug: "title", label: "Job Title", type: "string" });
		await registry.createField("employees", {
			slug: "pub_date",
			label: "Start Date",
			type: "datetime",
		});
	});

	afterEach(async () => {
		await database.close();
	});

	it("defaults to undefined when unset", async () => {
		const collection = await registry.getCollection("employees");
		expect(collection?.titleField).toBeUndefined();
		expect(collection?.dateField).toBeUndefined();
	});

	it("updateCollection sets titleField and dateField to valid fields", async () => {
		const updated = await registry.updateCollection("employees", {
			titleField: "name",
			dateField: "pub_date",
		});
		expect(updated.titleField).toBe("name");
		expect(updated.dateField).toBe("pub_date");

		const reread = await registry.getCollection("employees");
		expect(reread?.titleField).toBe("name");
		expect(reread?.dateField).toBe("pub_date");
	});

	it("clears titleField/dateField back to default with null", async () => {
		await registry.updateCollection("employees", { titleField: "name", dateField: "pub_date" });
		const cleared = await registry.updateCollection("employees", {
			titleField: null,
			dateField: null,
		});
		expect(cleared.titleField).toBeUndefined();
		expect(cleared.dateField).toBeUndefined();
	});

	it("leaves titleField/dateField unchanged on an unrelated update", async () => {
		await registry.updateCollection("employees", { titleField: "name", dateField: "pub_date" });
		const updated = await registry.updateCollection("employees", { label: "Team" });
		expect(updated.titleField).toBe("name");
		expect(updated.dateField).toBe("pub_date");
	});

	it("updateCollection rejects a titleField that does not exist", async () => {
		await expect(
			registry.updateCollection("employees", { titleField: "nonexistent" }),
		).rejects.toBeInstanceOf(SchemaError);
	});

	it("updateCollection rejects a titleField that isn't a text field", async () => {
		// `pub_date` is a datetime field — a raw date reads poorly as a title.
		await expect(
			registry.updateCollection("employees", { titleField: "pub_date" }),
		).rejects.toBeInstanceOf(SchemaError);
	});

	it("updateCollection rejects a dateField that is not a datetime field", async () => {
		await expect(
			registry.updateCollection("employees", { dateField: "title" }),
		).rejects.toBeInstanceOf(SchemaError);
	});

	it("updateCollection rejects a dateField that does not exist", async () => {
		await expect(
			registry.updateCollection("employees", { dateField: "nope" }),
		).rejects.toBeInstanceOf(SchemaError);
	});

	it("clears titleField/dateField when the referenced field is deleted", async () => {
		await registry.updateCollection("employees", { titleField: "name", dateField: "pub_date" });

		// Deleting the field that powers dateField must clear the reference, so
		// the content list doesn't later sort by a dropped column.
		await registry.deleteField("employees", "pub_date");
		const afterDate = await registry.getCollection("employees");
		expect(afterDate?.dateField).toBeUndefined();
		expect(afterDate?.titleField).toBe("name"); // unrelated reference untouched

		await registry.deleteField("employees", "name");
		const afterName = await registry.getCollection("employees");
		expect(afterName?.titleField).toBeUndefined();
	});

	it("rejects changing a dateField's type away from datetime", async () => {
		await registry.updateCollection("employees", { dateField: "pub_date" });
		// datetime and string both map to a TEXT column, so the column-type guard
		// alone wouldn't catch this — the titleField/dateField invariant must.
		await expect(
			registry.updateField("employees", "pub_date", { type: "string" }),
		).rejects.toBeInstanceOf(SchemaError);
	});

	it("rejects changing a titleField's type to a non-text field", async () => {
		await registry.updateCollection("employees", { titleField: "name" });
		await expect(registry.updateField("employees", "name", { type: "url" })).rejects.toBeInstanceOf(
			SchemaError,
		);
	});
});
