// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete source declarations; fixture/framework substitutions are in the ledger.
import {describe,beforeEach,afterEach} from 'node:test';
import {expect,it,compositionFixture} from './helpers/content-composition-fixture.ts';
let fixture:any;let repo:any;
beforeEach(async()=>{fixture=await compositionFixture();repo=fixture.repo;});
afterEach(async()=>{await fixture.database.close();});
describe('findMany complete basic/total declarations',()=>{
beforeEach(async()=>{for(let i=0;i<5;i++)await repo.create({type:'post',slug: `post-${i}`,data:{title: `Post ${i}`},status:i%2===0?'published':'draft',authorId:i<3?'author-1':'author-2'});});
it("should return all content by default", async () => {
			const result = await repo.findMany("post");

			expect(result.items).toHaveLength(5);
		});

it("should filter by status", async () => {
			const result = await repo.findMany("post", {
				where: { status: "published" },
			});

			expect(result.items).toHaveLength(3);
			expect(result.items.every((item) => item.status === "published")).toBe(true);
		});

it("should filter by authorId", async () => {
			const result = await repo.findMany("post", {
				where: { authorId: "author-1" },
			});

			expect(result.items).toHaveLength(3);
			expect(result.items.every((item) => item.authorId === "author-1")).toBe(true);
		});

it("should filter by both status and authorId", async () => {
			const result = await repo.findMany("post", {
				where: {
					status: "published",
					authorId: "author-1",
				},
			});

			expect(result.items).toHaveLength(2);
		});

it("should apply limit", async () => {
			const result = await repo.findMany("post", { limit: 2 });

			expect(result.items).toHaveLength(2);
		});

it("should support cursor pagination", async () => {
			const page1 = await repo.findMany("post", { limit: 2 });
			expect(page1.items).toHaveLength(2);
			expect(page1.nextCursor).toBeDefined();

			const page2 = await repo.findMany("post", {
				limit: 2,
				cursor: page1.nextCursor,
			});
			expect(page2.items).toHaveLength(2);

			// Items should be different
			const page1Ids = page1.items.map((i) => i.id);
			const page2Ids = page2.items.map((i) => i.id);
			expect(page1Ids).not.toEqual(page2Ids);
		});

it("should not include nextCursor when no more items", async () => {
			const result = await repo.findMany("post", { limit: 10 });

			expect(result.items).toHaveLength(5);
			expect(result.nextCursor).toBeUndefined();
		});

it("should order by createdAt desc by default", async () => {
			const result = await repo.findMany("post");

			// Items should be in descending order (newest first)
			for (let i = 1; i < result.items.length; i++) {
				expect(result.items[i - 1].createdAt >= result.items[i].createdAt).toBe(true);
			}
		});

it("should support custom ordering", async () => {
			const result = await repo.findMany("post", {
				orderBy: {
					field: "createdAt",
					direction: "asc",
				},
			});

			// Items should be in ascending order (oldest first)
			for (let i = 1; i < result.items.length; i++) {
				expect(result.items[i - 1].createdAt <= result.items[i].createdAt).toBe(true);
			}
		});

it("should default limit to 50", async () => {
			// Create more than 50 items
			for (let i = 0; i < 60; i++) {
				await repo.create({
					type: "page",
					data: { title: `Page ${i}` },
				});
			}

			const result = await repo.findMany("page");

			expect(result.items.length).toBeLessThanOrEqual(50);
		});

it("should cap limit at 100", async () => {
			const result = await repo.findMany("post", { limit: 200 });

			// Even with limit: 200, should not return more than 100
			expect(result.items.length).toBeLessThanOrEqual(100);
		});

it("should not include soft-deleted content", async () => {
			const toDelete = await repo.create({
				type: "post",
				data: { title: "To Delete" },
			});

			await repo.delete("post", toDelete.id);

			const result = await repo.findMany("post");

			expect(result.items.every((item) => item.id !== toDelete.id)).toBe(true);
		});

it("should return empty array when no items match", async () => {
			const result = await repo.findMany("page");

			expect(result.items).toEqual([]);
			expect(result.nextCursor).toBeUndefined();
		});

it("reports total rows regardless of limit", async () => {
				const result = await repo.findMany("post", { limit: 2 });

				expect(result.items).toHaveLength(2);
				expect(result.total).toBe(5);
			});

it("total respects the where clause", async () => {
				const result = await repo.findMany("post", {
					limit: 2,
					where: { status: "published" },
				});

				expect(result.total).toBe(3);
			});

it("total stays stable across cursor pages", async () => {
				const page1 = await repo.findMany("post", { limit: 2 });
				const page2 = await repo.findMany("post", {
					limit: 2,
					cursor: page1.nextCursor,
				});

				expect(page1.total).toBe(5);
				expect(page2.total).toBe(5);
			});
});
describe('count complete declarations',()=>{beforeEach(async()=>{for(let i=0;i<10;i++)await repo.create({type:'post',data:{title: `Post ${i}`},status:i%2===0?'published':'draft',authorId:i<5?'author-1':'author-2'});});
it("should count all content of a type", async () => {
			const count = await repo.count("post");

			expect(count).toBe(10);
		});

it("should count by status", async () => {
			const count = await repo.count("post", { status: "published" });

			expect(count).toBe(5);
		});

it("should count by authorId", async () => {
			const count = await repo.count("post", { authorId: "author-1" });

			expect(count).toBe(5);
		});

it("should count by both status and authorId", async () => {
			const count = await repo.count("post", {
				status: "published",
				authorId: "author-1",
			});

			// Posts 0, 2, 4 are published by author-1
			expect(count).toBe(3);
		});

it("should return 0 when no items match", async () => {
			const count = await repo.count("page");

			expect(count).toBe(0);
		});

it("should not count soft-deleted content", async () => {
			const created = await repo.create({
				type: "post",
				data: { title: "To Delete" },
			});

			await repo.delete("post", created.id);

			const count = await repo.count("post");

			expect(count).toBe(10); // Not 11
		});
});
