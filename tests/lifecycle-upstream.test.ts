// @ts-nocheck -- source Runtime envelopes are adapted at the fixture boundary.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT.
// See notices/emdash-MIT.txt and docs/lifecycle-ports.json for exact declaration provenance.
import { describe, beforeEach, afterEach } from 'node:test';
import { it, expect } from './helpers/lifecycle-expect.ts';
import { setupLifecycleFixture, SchemaRegistry } from './helpers/lifecycle-fixture.ts';

describe("packages/core/tests/integration/content/draft-save-live-content-changed.test.ts",()=>{
 let fixture, runtime, db;
 beforeEach(async()=>{fixture=await setupLifecycleFixture(); runtime=fixture.runtime; db=fixture.database.db;});
 afterEach(async()=>{await fixture.database.close();});
it("is false for draft-only data save on revision collections", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live" },
			slug: "live",
		});
		expect(created.success).toBe(true);
		const id = created.data!.item.id;
		await runtime.handleContentPublish("posts", id);

		const saved = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Draft edit" },
		});
		expect(saved.success).toBe(true);
		expect(saved.success && saved.liveContentChanged).toBe(false);
	});
it("is false when data+slug are staged as a draft revision", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live" },
			slug: "live",
		});
		const id = created.data!.item.id;
		await runtime.handleContentPublish("posts", id);

		const saved = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Live" },
			slug: "live-renamed",
		});
		expect(saved.success).toBe(true);
		expect(saved.success && saved.liveContentChanged).toBe(false);
	});
it("is true when live metadata changes on a revision collection", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live" },
			slug: "live-meta",
		});
		const id = created.data!.item.id;
		await runtime.handleContentPublish("posts", id);

		const saved = await runtime.handleContentUpdate("posts", id, {
			publishedAt: "2020-01-01T00:00:00.000Z",
		});
		expect(saved.success).toBe(true);
		expect(saved.success && saved.liveContentChanged).toBe(true);
	});
it("defaults unclassified update fields to live-changing", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live" },
			slug: "future-meta",
		});
		const id = created.data!.item.id;
		await runtime.handleContentPublish("posts", id);

		const saved = await runtime.handleContentUpdate("posts", id, {
			// @ts-expect-error - simulates a future live field before it joins the public input type
			futureLiveField: "changed",
		});
		expect(saved.success).toBe(true);
		expect(saved.success && saved.liveContentChanged).toBe(true);
	});
it("is true for data updates on collections without revisions", async () => {
		const created = await runtime.handleContentCreate("plain_posts", {
			data: { title: "Plain" },
			slug: "plain",
		});
		const id = created.data!.item.id;

		const updated = await runtime.handleContentUpdate("plain_posts", id, {
			data: { title: "Plain edited" },
		});
		expect(updated.success).toBe(true);
		expect(updated.success && updated.liveContentChanged).toBe(true);
	});
});

describe("packages/core/tests/integration/content/draft-save-updated-at.test.ts",()=>{
 let fixture, runtime, db;
 beforeEach(async()=>{fixture=await setupLifecycleFixture(); runtime=fixture.runtime; db=fixture.database.db;});
 afterEach(async()=>{await fixture.database.close();});
it("Save (draft staging) on a published entry does not bump updated_at", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live Post" },
			slug: "live-post",
		});
		expect(created.success).toBe(true);
		const id = created.data!.item.id;

		const published = await runtime.handleContentPublish("posts", id);
		expect(published.success).toBe(true);
		const publishedUpdatedAt = published.data!.item.updatedAt;

		// Manual Save: no skipRevision → creates a new draft revision and
		// points draft_revision_id at it. Live columns are untouched.
		const saved = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Live Post (edited, unpublished)" },
		});
		expect(saved.success).toBe(true);
		expect(saved.data!.item.draftRevisionId).not.toBeNull();

		expect(saved.data!.item.updatedAt).toBe(publishedUpdatedAt);
	});
it("Autosave (skipRevision) on an existing draft does not bump updated_at", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live Post" },
			slug: "live-post",
		});
		const id = created.data!.item.id;
		const published = await runtime.handleContentPublish("posts", id);
		const publishedUpdatedAt = published.data!.item.updatedAt;

		const firstSave = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Draft v1" },
		});
		expect(firstSave.success).toBe(true);
		expect(firstSave.data!.item.updatedAt).toBe(publishedUpdatedAt);

		// Autosave replaces the previous draft without changing the live row.
		const autosaved = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Draft v2" },
			skipRevision: true,
		});
		expect(autosaved.success).toBe(true);
		expect(autosaved.data!.item.updatedAt).toBe(publishedUpdatedAt);
	});
it("Discard Draft restores updated_at from before the draft saves", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live Post" },
			slug: "live-post",
		});
		const id = created.data!.item.id;
		const published = await runtime.handleContentPublish("posts", id);
		const publishedUpdatedAt = published.data!.item.updatedAt;

		const saved = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Unwanted edit" },
		});
		expect(saved.success).toBe(true);

		const discarded = await runtime.handleContentDiscardDraft("posts", id);
		expect(discarded.success).toBe(true);
		expect(discarded.data!.item.draftRevisionId).toBeNull();
		expect(discarded.data!.item.updatedAt).toBe(publishedUpdatedAt);
	});
it("a subsequent Publish advances updated_at exactly once", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live Post" },
			slug: "live-post",
		});
		const id = created.data!.item.id;
		const published = await runtime.handleContentPublish("posts", id);
		const publishedUpdatedAt = published.data!.item.updatedAt;

		const saved = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Ready to go live" },
		});
		expect(saved.data!.item.updatedAt).toBe(publishedUpdatedAt);

		// The draft saves left updated_at untouched, so comparing with Date.now()
		// proves publish moves it forward (same-millisecond collisions impossible).
		const republished = await runtime.handleContentPublish("posts", id);
		expect(republished.success).toBe(true);
		expect(republished.data!.item.draftRevisionId).toBeNull();
		expect(Date.parse(republished.data!.item.updatedAt)).toBeGreaterThan(
			Date.parse(publishedUpdatedAt),
		);
	});
it("draft-only saves still bump version so _rev concurrency detection keeps working", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Live Post" },
			slug: "live-post",
		});
		const id = created.data!.item.id;
		const published = await runtime.handleContentPublish("posts", id);
		const publishedUpdatedAt = published.data!.item.updatedAt;
		const publishedVersion = published.data!.item.version;

		const saved = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Edited" },
		});
		expect(saved.success).toBe(true);
		// updated_at frozen (no phantom modification), but version moved so a
		// second editor holding the pre-save _rev gets a 409.
		expect(saved.data!.item.updatedAt).toBe(publishedUpdatedAt);
		expect(saved.data!.item.version).toBe(publishedVersion + 1);

		const stale = await runtime.handleContentUpdate("posts", id, {
			data: { title: "Conflicting edit" },
			_rev: Buffer.from(`${publishedVersion}:${publishedUpdatedAt}`).toString("base64"),
		});
		expect(stale.success).toBe(false);
		expect(stale.success === false && stale.error.code).toBe("CONFLICT");
	});
it("Restore Revision (to draft) on a published entry does not bump updated_at", async () => {
		const created = await runtime.handleContentCreate("posts", {
			data: { title: "Original" },
			slug: "restore-post",
		});
		const id = created.data!.item.id;
		const published = await runtime.handleContentPublish("posts", id);
		const publishedUpdatedAt = published.data!.item.updatedAt;

		// Find the published revision to restore from.
		const revisions = await runtime.handleRevisionList("posts", id);
		expect(revisions.success).toBe(true);
		const liveRevisionId = published.data!.item.liveRevisionId;
		const targetRevision = revisions.data!.items.find((r) => r.id === liveRevisionId);
		expect(targetRevision).toBeDefined();

		// Restore that revision as the current draft — draft-only staging,
		// live columns untouched, so updated_at must not move.
		const restored = await runtime.handleRevisionRestore(targetRevision!.id, "author-1");
		expect(restored.success).toBe(true);
		expect(restored.data!.item.updatedAt).toBe(publishedUpdatedAt);
		expect(restored.data!.item.draftRevisionId).not.toBeNull();
	});
it("collections without revision support keep the bump-on-write behavior", async () => {
		const created = await runtime.handleContentCreate("plain_posts", {
			data: { title: "Plain" },
			slug: "plain",
		});
		const id = created.data!.item.id;
		const beforeUpdate = created.data!.item.updatedAt;

		const updated = await runtime.handleContentUpdate("plain_posts", id, {
			data: { title: "Plain (edited)" },
		});
		expect(updated.success).toBe(true);
		expect(Date.parse(updated.data!.item.updatedAt)).toBeGreaterThanOrEqual(
			Date.parse(beforeUpdate),
		);
	});
});

describe("packages/core/tests/unit/api/publish-revision-cas.test.ts",()=>{
 let fixture, runtime, db;
 beforeEach(async()=>{fixture=await setupLifecycleFixture(); runtime=fixture.runtime; db=fixture.database.db;});
 afterEach(async()=>{await fixture.database.close();});
	async function createPublished(title = "Live") {
		const created = await runtime.handleContentCreate("post", {
			data: { title },
			slug: title.toLowerCase(),
		});
		expect(created.success).toBe(true);
		const published = await runtime.handleContentPublish("post", created.data!.item.id);
		expect(published.success).toBe(true);
		return published.data!;
	}

it("publishes only the expected revision and returns the next _rev", async () => {
		const created = await createPublished();
		const saved = await runtime.handleContentUpdate("post", created.item.id, {
			data: { title: "Approved" },
			_rev: created._rev,
		});
		expect(saved.success).toBe(true);

		const published = await runtime.handleContentPublish("post", created.item.id, {
			_rev: saved.data!._rev,
		});

		expect(published.success).toBe(true);
		expect(published.data!.item.data.title).toBe("Approved");
		expect(published.data!._rev).toBeTruthy();
		expect(published.data!._rev).not.toBe(saved.data!._rev);

		const nextSave = await runtime.handleContentUpdate("post", created.item.id, {
			data: { title: "Next" },
			_rev: published.data!._rev,
		});
		expect(nextSave.success).toBe(true);
	});
it("rejects an approved revision after a newer draft save without mutating live or draft", async () => {
		const created = await createPublished();
		const approved = await runtime.handleContentUpdate("post", created.item.id, {
			data: { title: "Approved A" },
			_rev: created._rev,
		});
		const newer = await runtime.handleContentUpdate("post", created.item.id, {
			data: { title: "Writer B" },
			_rev: approved.data!._rev,
			skipRevision: true,
		});
		expect(newer.data!.item.draftRevisionId).not.toBe(approved.data!.item.draftRevisionId);
		const before = await runtime.handleContentGet("post", created.item.id);

		const stale = await runtime.handleContentPublish("post", created.item.id, {
			_rev: approved.data!._rev,
		});
		const after = await runtime.handleContentGet("post", created.item.id);

		expect(stale).toMatchObject({ success: false, error: { code: "CONFLICT" } });
		expect(after.data!.item.liveRevisionId).toBe(before.data!.item.liveRevisionId);
		expect(after.data!.item.draftRevisionId).toBe(before.data!.item.draftRevisionId);
		expect(after.data!._rev).toBe(newer.data!._rev);
	});
it("allows only one of two concurrent publishes for the same _rev", async () => {
		const created = await createPublished();
		const saved = await runtime.handleContentUpdate("post", created.item.id, {
			data: { title: "Approved" },
			_rev: created._rev,
		});

		const results = await Promise.all([
			runtime.handleContentPublish("post", created.item.id, { _rev: saved.data!._rev }),
			runtime.handleContentPublish("post", created.item.id, { _rev: saved.data!._rev }),
		]);

		expect(results.filter((result) => result.success)).toHaveLength(1);
		expect(
			results.filter((result) => !result.success && result.error.code === "CONFLICT"),
		).toHaveLength(1);
		const published = await runtime.handleContentGet("post", created.item.id);
		expect(published.data!.item.data.title).toBe("Approved");
		expect(published.data!.item.draftRevisionId).toBeNull();
	});
it("supports conditional publish for a collection without revisions", async () => {
		const registry = new SchemaRegistry(db);
		await registry.updateCollection("post", { supports: [] });
		const created = await createPublished();

		const published = await runtime.handleContentPublish("post", created.item.id, {
			_rev: created._rev,
		});

		expect(published.success).toBe(true);
		expect(published.data!._rev).not.toBe(created._rev);
	});
it("applies the same revision condition to unpublish and discard-draft", async () => {
		const created = await createPublished();
		const saved = await runtime.handleContentUpdate("post", created.item.id, {
			data: { title: "Pending" },
			_rev: created._rev,
		});

		const staleUnpublish = await runtime.handleContentUnpublish("post", created.item.id, {
			_rev: created._rev,
		});
		const staleDiscard = await runtime.handleContentDiscardDraft("post", created.item.id, {
			_rev: created._rev,
		});
		expect(staleUnpublish).toMatchObject({ success: false, error: { code: "CONFLICT" } });
		expect(staleDiscard).toMatchObject({ success: false, error: { code: "CONFLICT" } });

		const discarded = await runtime.handleContentDiscardDraft("post", created.item.id, {
			_rev: saved.data!._rev,
		});
		expect(discarded.success).toBe(true);
		expect(discarded.data!._rev).not.toBe(saved.data!._rev);
	});
it("keeps revisionless publish calls backward compatible", async () => {
		const created = await createPublished();
		const published = await runtime.handleContentPublish("post", created.item.id);

		expect(published.success).toBe(true);
		expect(published.data!._rev).toBeTruthy();
	});
it("rejects malformed revision conditions as conflicts", async () => {
		const created = await createPublished();
		const published = await runtime.handleContentPublish("post", created.item.id, {
			_rev: "not-a-revision",
		});

		expect(published).toMatchObject({ success: false, error: { code: "CONFLICT" } });
	});
});
