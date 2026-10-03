// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete source declarations; fixture/framework substitutions are in the ledger.
import {describe,beforeEach,afterEach} from 'node:test';
import {expect,it,compositionFixture} from './helpers/content-composition-fixture.ts';
let fixture:any;let ctx:any;let aliceId:string;let bobId:string;
beforeEach(async()=>{fixture=await compositionFixture();ctx={db:fixture};aliceId='alice';bobId='bob';for(const s of [{slug:'y2023',title:'Old',priority:'normal',authorId:aliceId,createdAt:'2023-06-01T12:00:00.000Z'},{slug:'y2024',title:'Mid',priority:'urgent',authorId:bobId,createdAt:'2024-06-01T12:00:00.000Z'},{slug:'y2025',title:'New',priority:'high',authorId:aliceId,createdAt:'2025-06-01T12:00:00.000Z'}]){const item=await fixture.repo.create({type:'posts',slug:s.slug,data:{title:s.title,priority:s.priority},authorId:s.authorId});await fixture.setCreatedAt('posts',item.id,s.createdAt);}});
afterEach(async()=>{await fixture.database.close();});
function handleContentList(db:any,type:string,params:any){return db.listHandler(type,params);}
function slugsOf(result:{success:boolean;data?:{items:{slug:string|null}[]}}):string[]{if(!result.success||!result.data)throw new Error('list failed');return result.data.items.map(i=>i.slug??'');}
it("filters by author", async () => {
		const result = await handleContentList(ctx.db, "posts", { authorId: aliceId });
		const slugs = slugsOf(result).toSorted();
		expect(slugs).toEqual(["y2023", "y2025"]);
		if (!result.success) throw new Error("list failed");
		// total must reflect the filter, not the full collection.
		expect(result.data.total).toBe(2);
	});

it("passes indexed custom-field filters through the list handler", async () => {
		const result = await handleContentList(ctx.db, "posts", {
			fieldFilters: { priority: { in: ["urgent", "high"] } },
		});

		expect(slugsOf(result).toSorted()).toEqual(["y2024", "y2025"]);
		if (!result.success) throw new Error("list failed");
		expect(result.data.total).toBe(2);
	});

it("reports a missing collection the same way with and without field filters", async () => {
		const withFilters = await handleContentList(ctx.db, "ghosts", {
			fieldFilters: { priority: "urgent" },
		});
		const withoutFilters = await handleContentList(ctx.db, "ghosts", {});

		expect(withFilters.success).toBe(false);
		expect(withoutFilters.success).toBe(false);
		if (withFilters.success || withoutFilters.success) throw new Error("expected failures");
		expect(withFilters.error.code).toBe("COLLECTION_NOT_FOUND");
		expect(withFilters.error.code).toBe(withoutFilters.error.code);
	});

it("reports a missing collection ahead of an invalid field filter name", async () => {
		const result = await handleContentList(ctx.db, "ghosts", {
			fieldFilters: { "not a field": "urgent" },
		});

		expect(result.success).toBe(false);
		if (result.success) throw new Error("expected a failure");
		expect(result.error.code).toBe("COLLECTION_NOT_FOUND");
	});

it("reports a missing collection ahead of an oversized filter set", async () => {
		const fieldFilters = Object.fromEntries(
			Array.from({ length: 21 }, (_, index) => [`field_${index}`, "value"]),
		);
		const result = await handleContentList(ctx.db, "ghosts", { fieldFilters });

		expect(result.success).toBe(false);
		if (result.success) throw new Error("expected a failure");
		expect(result.error.code).toBe("COLLECTION_NOT_FOUND");
	});

it("rejects an oversized filter set on a collection that exists", async () => {
		const fieldFilters = Object.fromEntries(
			Array.from({ length: 21 }, (_, index) => [`field_${index}`, "value"]),
		);
		const result = await handleContentList(ctx.db, "posts", { fieldFilters });

		expect(result.success).toBe(false);
		if (result.success) throw new Error("expected a failure");
		expect(result.error.code).toBe("VALIDATION_ERROR");
	});

it("rejects an invalid field filter name on a collection that exists", async () => {
		const result = await handleContentList(ctx.db, "posts", {
			fieldFilters: { "not a field": "urgent" },
		});

		expect(result.success).toBe(false);
		if (result.success) throw new Error("expected a failure");
		expect(result.error.code).toBe("VALIDATION_ERROR");
	});

it("filters by an inclusive createdAt date range", async () => {
		const result = await handleContentList(ctx.db, "posts", {
			dateField: "createdAt",
			dateFrom: "2024-01-01T00:00:00.000Z",
			dateTo: "2024-12-31T23:59:59.999Z",
		});
		expect(slugsOf(result)).toEqual(["y2024"]);
	});

it("normalizes offset-bearing date bounds before comparing canonical storage", async () => {
		const result = await handleContentList(ctx.db, "posts", {
			dateField: "createdAt",
			dateFrom: "2024-06-01T21:00:00+09:00",
			dateTo: "2024-06-01T08:00:00-04:00",
		});
		expect(slugsOf(result)).toEqual(["y2024"]);
	});

it("includes a boundary timestamp when the upper bound is end-of-day", async () => {
		// The 2025 post is at 12:00; an end-of-day upper bound must include it.
		const result = await handleContentList(ctx.db, "posts", {
			dateField: "createdAt",
			dateFrom: "2025-06-01T00:00:00.000Z",
			dateTo: "2025-06-01T23:59:59.999Z",
		});
		expect(slugsOf(result)).toEqual(["y2025"]);
	});

it("treats a date-only upper bound as inclusive of the whole day", async () => {
		// Regression: a bare `YYYY-MM-DD` upper bound must be widened to the
		// end of the day server-side, otherwise the 2024 post at 12:00 would
		// be excluded (since `2024-06-01T12:00:00Z` sorts after `2024-06-01`).
		const result = await handleContentList(ctx.db, "posts", {
			dateField: "createdAt",
			dateFrom: "2024-06-01",
			dateTo: "2024-06-01",
		});
		expect(slugsOf(result)).toEqual(["y2024"]);
	});

it("supports an open-ended (from-only) range", async () => {
		const result = await handleContentList(ctx.db, "posts", {
			dateField: "createdAt",
			dateFrom: "2024-06-01T00:00:00.000Z",
		});
		expect(slugsOf(result).toSorted()).toEqual(["y2024", "y2025"]);
	});

it("combines author and date range filters", async () => {
		const result = await handleContentList(ctx.db, "posts", {
			authorId: aliceId,
			dateField: "createdAt",
			dateFrom: "2025-01-01T00:00:00.000Z",
		});
		expect(slugsOf(result)).toEqual(["y2025"]);
	});

it("ignores a date range with no field", async () => {
		// Half-specified filter (from/to without a field) must not silently
		// drop every row — it should behave as if no date filter was set.
		const result = await handleContentList(ctx.db, "posts", {
			dateFrom: "2024-01-01T00:00:00.000Z",
		});
		expect(slugsOf(result)).toHaveLength(3);
	});

it("a publishedAt range excludes never-published rows", async () => {
		// None of the seeded posts are published, so a publishedAt range
		// returns nothing (their published_at is NULL).
		const result = await handleContentList(ctx.db, "posts", {
			dateField: "publishedAt",
			dateFrom: "2000-01-01T00:00:00.000Z",
			dateTo: "2100-01-01T00:00:00.000Z",
		});
		expect(slugsOf(result)).toHaveLength(0);
	});