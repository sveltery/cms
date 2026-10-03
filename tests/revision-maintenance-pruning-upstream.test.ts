// @ts-nocheck -- complete pinned callbacks; test-only framework and namespace host.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; provenance: docs/revision-maintenance-ports.json.
import {describe,beforeEach,afterEach} from 'node:test';
import {it,expect,RevisionRepository,setupTestDatabaseWithCollections} from './helpers/revision-maintenance/fixture.ts';

for(const mode of ['reference','product'])for(const dialect of ['Node','D1'])describe('RV1 '+mode+' '+dialect+' complete repository pruning callbacks',()=>{
 let ctx;
 beforeEach(async()=>{process.env.SVELTERY_REVISION_TEST_MODE=mode;ctx={db:await setupTestDatabaseWithCollections(dialect)};});
 afterEach(async()=>{await ctx.db.destroy();delete process.env.SVELTERY_REVISION_TEST_MODE;});
it("does not delete a revision inserted after the queued prune snapshot", async () => {
		const revisions = new RevisionRepository(ctx.db);
		const entryId = "concurrent-save";
		const timestamp = new Date().toISOString();
		await ctx.db
			.insertInto("ec_post")
			.values({
				id: entryId,
				slug: entryId,
				status: "published",
				created_at: timestamp,
				updated_at: timestamp,
				version: 1,
			})
			.execute();

		const live = await revisions.create({
			collection: "post",
			entryId,
			data: { title: "Live" },
		});
		let queued = live;
		for (let index = 0; index < 51; index++) {
			queued = await revisions.create({
				collection: "post",
				entryId,
				data: { title: `History ${index}` },
			});
		}
		await ctx.db
			.updateTable("ec_post")
			.set({ live_revision_id: live.id })
			.where("id", "=", entryId)
			.execute();

		let concurrentRevisionId: string | undefined;
		const plugin = new InsertAfterPruneSnapshotPlugin(async () => {
			const concurrent = await revisions.create({
				collection: "post",
				entryId,
				data: { title: "Concurrent draft" },
			});
			concurrentRevisionId = concurrent.id;
		});
		const pruning = new RevisionRepository(ctx.db.withPlugin(plugin));

		const pruned = await pruning.pruneQueuedEntry("post", entryId, queued.id, 50);

		expect(pruned).toBe(1);
		expect(concurrentRevisionId).toBeDefined();
		expect(await revisions.findById(concurrentRevisionId!)).not.toBeNull();
		await ctx.db
			.updateTable("ec_post")
			.set({ draft_revision_id: concurrentRevisionId })
			.where("id", "=", entryId)
			.execute();
		expect(
			await ctx.db
				.selectFrom("ec_post")
				.select("draft_revision_id")
				.where("id", "=", entryId)
				.executeTakeFirst(),
		).toEqual({ draft_revision_id: concurrentRevisionId });
		expect(
			await ctx.db
				.selectFrom("_emdash_revision_prune_queue")
				.select("revision_id")
				.where("collection", "=", "post")
				.where("entry_id", "=", entryId)
				.executeTakeFirst(),
		).toEqual({ revision_id: concurrentRevisionId });
	});
it("prunes through the queued revision while preserving referenced live and draft revisions", async () => {
		const revisions = new RevisionRepository(ctx.db);
		const entryId = "referenced-revisions";
		const timestamp = new Date().toISOString();
		await ctx.db
			.insertInto("ec_post")
			.values({
				id: entryId,
				slug: entryId,
				status: "published",
				created_at: timestamp,
				updated_at: timestamp,
				version: 1,
			})
			.execute();

		const live = await revisions.create({
			collection: "post",
			entryId,
			data: { title: "Old live" },
		});
		const draft = await revisions.create({
			collection: "post",
			entryId,
			data: { title: "Old draft" },
		});
		let queued = draft;
		for (let index = 0; index < 55; index++) {
			queued = await revisions.create({
				collection: "post",
				entryId,
				data: { title: `History ${index}` },
			});
		}
		await ctx.db
			.updateTable("ec_post")
			.set({ live_revision_id: live.id, draft_revision_id: draft.id })
			.where("id", "=", entryId)
			.execute();

		const pruned = await revisions.pruneQueuedEntry("post", entryId, queued.id, 10);

		expect(pruned).toBe(45);
		expect(await revisions.countByEntry("post", entryId)).toBe(12);
		expect(await revisions.findById(live.id)).not.toBeNull();
		expect(await revisions.findById(draft.id)).not.toBeNull();
	});
});
