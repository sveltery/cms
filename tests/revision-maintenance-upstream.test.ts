// @ts-nocheck -- complete pinned callbacks; test-only framework and namespace host.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; provenance: docs/revision-maintenance-ports.json.
import {describe,beforeEach,afterEach} from 'node:test';
import {ulid} from 'ulidx';
import {it,expect,Kysely,SqliteDialect,BetterSqlite3,RevisionRepository,setupTestDatabaseWithCollections,runMigrations,runSystemCleanup} from './helpers/revision-maintenance/fixture.ts';
for(const mode of ['reference','product'])describe('RV1 '+mode+' complete cleanup callbacks',()=>{
 beforeEach(()=>process.env.SVELTERY_REVISION_TEST_MODE=mode);
 afterEach(()=>delete process.env.SVELTERY_REVISION_TEST_MODE);
 describe('Revision Pruning',()=>{let db,revisionRepo;beforeEach(async()=>{db=await setupTestDatabaseWithCollections();revisionRepo=new RevisionRepository(db);});afterEach(async()=>db.destroy());
it("prunes old revisions keeping the most recent N", async () => {
		const entryId = ulid();

		// Create a content entry
		const { sql } = await import("kysely");
		await sql`
			INSERT INTO ec_post (id, slug, status, created_at, updated_at, version)
			VALUES (${entryId}, ${"test-post"}, ${"draft"}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${1})
		`.execute(db);

		// Create 200 revisions
		for (let i = 0; i < 200; i++) {
			await revisionRepo.create({
				collection: "post",
				entryId,
				data: { title: `Version ${i + 1}` },
			});
		}

		const countBefore = await revisionRepo.countByEntry("post", entryId);
		expect(countBefore).toBe(200);

		// Prune to keep 50
		const pruned = await revisionRepo.pruneOldRevisions("post", entryId, 50);

		expect(pruned).toBe(150);

		const countAfter = await revisionRepo.countByEntry("post", entryId);
		expect(countAfter).toBe(50);

		// Verify the remaining 50 are the newest
		const remaining = await revisionRepo.findByEntry("post", entryId);
		expect(remaining[0]?.data.title).toBe("Version 200");
		expect(remaining[49]?.data.title).toBe("Version 151");
	});
it("is a no-op when revision count is at or below keepCount", async () => {
		const entryId = ulid();

		const { sql } = await import("kysely");
		await sql`
			INSERT INTO ec_post (id, slug, status, created_at, updated_at, version)
			VALUES (${entryId}, ${"test-post-2"}, ${"draft"}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${1})
		`.execute(db);

		// Create 10 revisions
		for (let i = 0; i < 10; i++) {
			await revisionRepo.create({
				collection: "post",
				entryId,
				data: { title: `Version ${i + 1}` },
			});
		}

		const pruned = await revisionRepo.pruneOldRevisions("post", entryId, 50);
		expect(pruned).toBe(0);

		const countAfter = await revisionRepo.countByEntry("post", entryId);
		expect(countAfter).toBe(10);
	});
it("prunes eligible history while preserving old live and current draft revisions", async () => {
		const entryId = ulid();
		const { sql } = await import("kysely");
		await sql`
			INSERT INTO ec_post (id, slug, status, created_at, updated_at, version)
			VALUES (${entryId}, ${"referenced-revisions"}, ${"published"}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${1})
		`.execute(db);
		const live = await revisionRepo.create({
			collection: "post",
			entryId,
			data: { title: "Old live" },
		});
		for (let i = 0; i < 55; i++) {
			await revisionRepo.create({
				collection: "post",
				entryId,
				data: { title: `History ${i}` },
			});
		}
		const draft = await revisionRepo.create({
			collection: "post",
			entryId,
			data: { title: "Current draft" },
		});
		await sql`
			UPDATE ec_post
			SET live_revision_id = ${live.id}, draft_revision_id = ${draft.id}
			WHERE id = ${entryId}
		`.execute(db);

		const pruned = await revisionRepo.pruneOldRevisions("post", entryId, 10);

		expect(pruned).toBe(46);
		expect(await revisionRepo.findById(live.id)).not.toBeNull();
		expect(await revisionRepo.findById(draft.id)).not.toBeNull();
		expect(await revisionRepo.countByEntry("post", entryId)).toBe(11);
	});
 });
 describe('Scheduled cleanup revision projection',()=>{
it("prunes revision entries queued by revision writes", async () => {
		const db = await setupTestDatabaseWithCollections();
		const revisionRepo = new RevisionRepository(db);
		const entryId = ulid();
		const { sql } = await import("kysely");

		try {
			await sql`
				INSERT INTO ec_post (id, slug, status, created_at, updated_at, version)
				VALUES (${entryId}, ${"queued-history"}, ${"draft"}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${1})
			`.execute(db);
			for (let i = 0; i < 51; i++) {
				await revisionRepo.create({
					collection: "post",
					entryId,
					data: { title: `Version ${i + 1}` },
				});
			}

			const result = await runSystemCleanup(db);

			expect(result.revisionsPruned).toBe(1);
			expect(await revisionRepo.countByEntry("post", entryId)).toBe(50);
			expect(
				await db.selectFrom("_emdash_revision_prune_queue").select("entry_id").execute(),
			).toEqual([]);
		} finally {
			await db.destroy();
		}
	});
it("processes the oldest queued revision entries first", async () => {
		const db = await setupTestDatabaseWithCollections();
		const revisionRepo = new RevisionRepository(db);
		const { sql } = await import("kysely");
		const entryIds = ["z-old", ...Array.from({ length: 10 }, (_, index) => `a0${index}`)];

		try {
			for (const entryId of entryIds) {
				await sql`
					INSERT INTO ec_post (id, slug, status, created_at, updated_at, version)
					VALUES (${entryId}, ${entryId}, ${"draft"}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${1})
				`.execute(db);
				await revisionRepo.create({
					collection: "post",
					entryId,
					data: { title: entryId },
				});
			}

			await runSystemCleanup(db);

			const remaining = await db
				.selectFrom("_emdash_revision_prune_queue")
				.select("entry_id")
				.execute();
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.entry_id).toMatch(/^a/);
			expect(remaining).not.toContainEqual({ entry_id: "z-old" });
		} finally {
			await db.destroy();
		}
	});
it("does not query the full revision history", async () => {
		const sqlite = new BetterSqlite3(":memory:");
		const queries: string[] = [];
		const db = new Kysely<Database>({
			dialect: new SqliteDialect({ database: sqlite }),
			log: (event) => {
				if (event.level === "query") queries.push(event.query.sql);
			},
		});

		try {
			await runMigrations(db);
			queries.length = 0;
			await runSystemCleanup(db);

			const revisionQueries = queries.filter((query) =>
				/\b(?:from|delete from)\s+["`]?revisions\b/i.test(query),
			);
			expect(revisionQueries).toHaveLength(0);
		} finally {
			await db.destroy();
		}
	});
 });
});
