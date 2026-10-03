// @ts-nocheck -- complete pinned callback bodies, native real database/runtime hosts.
// EmDash1.1.0 MIT2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import{describe,it,expect,beforeEach,afterEach}from'vitest';
import{getSiteSettingsWithDb,getSiteSettingWithDb,getSiteSettings,setSiteSettings,invalidateSiteSettingsCache}from'../../../src/lib/server/settings/index.ts';
import{runWithContext}from'../../../src/lib/server/settings/context.ts';
import{selectSettingsMediaDialect,setupTestDatabase,closeSettingsMediaDatabases}from'../../helpers/settings-media-fixture.ts';

for(const target of ['sqlite','d1']){
 describe('Complete pinned media settings resolution ['+target+']',()=>{
  let db;beforeEach(async()=>{selectSettingsMediaDialect(target);invalidateSiteSettingsCache();db=await setupTestDatabase();});
  afterEach(closeSettingsMediaDatabases);
it("resolves seo.defaultOgImage to a media file URL via getSiteSettings", async () => {
			const mediaId = "med_og_default";
			const now = new Date().toISOString();
			await db
				.insertInto("media" as never)
				.values({
					id: mediaId,
					filename: "og.png",
					mime_type: "image/png",
					size: 2048,
					width: 1200,
					height: 630,
					storage_key: `media/${mediaId}.png`,
					created_at: now,
				} as never)
				.execute();

			await setSiteSettings(
				{
					seo: {
						defaultOgImage: { mediaId, alt: "Default OG" },
					},
				},
				db,
			);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.seo?.defaultOgImage?.mediaId).toBe(mediaId);
			expect(settings.seo?.defaultOgImage?.alt).toBe("Default OG");
			expect(settings.seo?.defaultOgImage?.url).toBe(
				`/_emdash/api/media/file/media/${mediaId}.png`,
			);
			expect(settings.seo?.defaultOgImage?.contentType).toBe("image/png");
			expect(settings.seo?.defaultOgImage?.width).toBe(1200);
			expect(settings.seo?.defaultOgImage?.height).toBe(630);
		});

it("resolves seo.defaultOgImage via getSiteSetting('seo')", async () => {
			const mediaId = "med_og_per_key";
			const now = new Date().toISOString();
			await db
				.insertInto("media" as never)
				.values({
					id: mediaId,
					filename: "og.png",
					mime_type: "image/png",
					size: 1024,
					storage_key: `media/${mediaId}.png`,
					created_at: now,
				} as never)
				.execute();

			await setSiteSettings(
				{
					seo: {
						defaultOgImage: { mediaId },
						titleSeparator: " | ",
					},
				},
				db,
			);

			const seo = await getSiteSettingWithDb("seo", db);
			expect(seo?.defaultOgImage?.url).toBe(`/_emdash/api/media/file/media/${mediaId}.png`);
			// Sibling fields preserved through the resolve+spread.
			expect(seo?.titleSeparator).toBe(" | ");
		});
 });
 describe('Complete pinned media mutation cache ['+target+']',()=>{
  beforeEach(()=>{selectSettingsMediaDialect(target);invalidateSiteSettingsCache();});afterEach(closeSettingsMediaDatabases);
it("EmDashRuntime.handleMediaDelete invalidates the cache on success", async () => {
		const { createTestRuntime } = await import("../../utils/mcp-runtime.js");
		const { setupTestDatabaseWithCollections } = await import("../../utils/test-db.js");

		const db = await setupTestDatabaseWithCollections();
		const runtime = createTestRuntime(db);

		// Seed a media row and reference it from settings so we can prove
		// invalidation flushes the resolved snapshot.
		const mediaId = "med_invalidation_delete";
		const now = new Date().toISOString();
		await db
			.insertInto("media" as never)
			.values({
				id: mediaId,
				filename: "og.png",
				mime_type: "image/png",
				size: 1024,
				storage_key: `media/${mediaId}.png`,
				created_at: now,
			} as never)
			.execute();
		await setSiteSettings({ seo: { defaultOgImage: { mediaId } } }, db);

		await runWithContext({ editMode: false, db }, async () => {
			const before = await getSiteSettings();
			expect(before.seo?.defaultOgImage?.url).toContain(mediaId);
		});

		const result = await runtime.handleMediaDelete(mediaId);
		expect(result.success).toBe(true);

		// After delete, the resolved snapshot must be re-fetched; with the
		// media row gone, the URL field disappears.
		await runWithContext({ editMode: false, db }, async () => {
			const after = await getSiteSettings();
			expect(after.seo?.defaultOgImage?.url).toBeUndefined();
		});
	});

it("EmDashRuntime.handleMediaUpdate invalidates the cache on success", async () => {
		const { createTestRuntime } = await import("../../utils/mcp-runtime.js");
		const { setupTestDatabaseWithCollections } = await import("../../utils/test-db.js");

		const db = await setupTestDatabaseWithCollections();
		const runtime = createTestRuntime(db);

		const mediaId = "med_invalidation_update";
		const now = new Date().toISOString();
		await db
			.insertInto("media" as never)
			.values({
				id: mediaId,
				filename: "og.png",
				mime_type: "image/png",
				size: 1024,
				width: 800,
				height: 600,
				storage_key: `media/${mediaId}.png`,
				created_at: now,
			} as never)
			.execute();
		await setSiteSettings({ seo: { defaultOgImage: { mediaId } } }, db);

		await runWithContext({ editMode: false, db }, async () => {
			const before = await getSiteSettings();
			expect(before.seo?.defaultOgImage?.width).toBe(800);
		});

		const result = await runtime.handleMediaUpdate(mediaId, { width: 1200, height: 630 });
		expect(result.success).toBe(true);

		await runWithContext({ editMode: false, db }, async () => {
			const after = await getSiteSettings();
			expect(after.seo?.defaultOgImage?.width).toBe(1200);
			expect(after.seo?.defaultOgImage?.height).toBe(630);
		});
	});

it("EmDashRuntime.handleMediaReplaceMetadata invalidates the cache on success", async () => {
		const { createTestRuntime } = await import("../../utils/mcp-runtime.js");
		const { setupTestDatabaseWithCollections } = await import("../../utils/test-db.js");

		const db = await setupTestDatabaseWithCollections();
		const runtime = createTestRuntime(db);
		const mediaId = "med_invalidation_replace";
		const storageKey = `media/${mediaId}.png`;
		await db
			.insertInto("media" as never)
			.values({
				id: mediaId,
				filename: "og.png",
				mime_type: "image/png",
				size: 1024,
				width: 800,
				height: 600,
				storage_key: storageKey,
				created_at: new Date().toISOString(),
			} as never)
			.execute();
		await setSiteSettings({ seo: { defaultOgImage: { mediaId } } }, db);

		await runWithContext({ editMode: false, db }, async () => {
			expect((await getSiteSettings()).seo?.defaultOgImage?.width).toBe(800);
		});

		const result = await runtime.handleMediaReplaceMetadata(mediaId, storageKey, {
			size: 512,
			width: 400,
			height: 300,
			contentHash: "sha256:replacement",
		});
		expect(result.success).toBe(true);

		await runWithContext({ editMode: false, db }, async () => {
			const after = await getSiteSettings();
			expect(after.seo?.defaultOgImage?.width).toBe(400);
			expect(after.seo?.defaultOgImage?.height).toBe(300);
		});
	});
 });
}
