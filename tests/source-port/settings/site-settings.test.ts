// @ts-nocheck -- unchanged pinned source callback bodies with native storage setup.
// EmDash 1.1.0 MIT Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
import {sql} from 'kysely';
import {describe,beforeEach,afterEach,it,expect} from 'vitest';
import {openSqlite} from '../../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {OptionsRepository} from '../../../src/lib/server/settings/options.ts';
import {settingsDb,getSiteSettingsWithDb,getSiteSettingWithDb,setSiteSettings} from '../../../src/lib/server/settings/index.ts';
describe('Site Settings: complete pinned callbacks',()=>{
 let db,database;
 beforeEach(async()=>{database=openSqlite(':memory:');await migrateCms(database);db=settingsDb(database);});
 afterEach(async()=>{await database.close();});
		it("should store settings with site: prefix", async () => {
			await setSiteSettings({ title: "Test Site" }, db);

			const row = await db
				.selectFrom("options")
				.where("name", "=", "site:title")
				.select("value")
				.executeTakeFirst();

			expect(row?.value).toBe('"Test Site"');
		});
		it("should merge with existing settings", async () => {
			await setSiteSettings({ title: "Test" }, db);
			await setSiteSettings({ tagline: "Welcome" }, db);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.title).toBe("Test");
			expect(settings.tagline).toBe("Welcome");
		});
		it("should store complex objects", async () => {
			await setSiteSettings(
				{
					social: {
						twitter: "@handle",
						github: "user",
					},
				},
				db,
			);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.social?.twitter).toBe("@handle");
			expect(settings.social?.github).toBe("user");
		});
		it("should store logo with mediaId", async () => {
			await setSiteSettings(
				{
					logo: { mediaId: "med_123", alt: "Logo" },
				},
				db,
			);

			const row = await db
				.selectFrom("options")
				.where("name", "=", "site:logo")
				.select("value")
				.executeTakeFirst();

			const parsed = JSON.parse(row?.value || "{}");
			expect(parsed.mediaId).toBe("med_123");
			expect(parsed.alt).toBe("Logo");
		});
		it("deletes media settings while preserving sibling SEO settings", async () => {
			await setSiteSettings(
				{
					logo: { mediaId: "med_logo" },
					favicon: { mediaId: "med_favicon" },
					seo: {
						defaultOgImage: { mediaId: "med_og" },
						titleSeparator: " — ",
						googleVerification: "google-code",
					},
				},
				db,
			);

			await setSiteSettings({ logo: null, favicon: null, seo: { defaultOgImage: null } }, db);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.logo).toBeUndefined();
			expect(settings.favicon).toBeUndefined();
			expect(settings.seo).toEqual({
				titleSeparator: " — ",
				googleVerification: "google-code",
			});
			expect(await new OptionsRepository(db).exists("site:logo")).toBe(false);
			expect(await new OptionsRepository(db).exists("site:favicon")).toBe(false);
			const storedSeo = await new OptionsRepository(db).get<Record<string, unknown>>("site:seo");
			expect(storedSeo).not.toHaveProperty("defaultOgImage");
		});
		it("deletes the SEO option when its only media reference is removed", async () => {
			await setSiteSettings({ seo: { defaultOgImage: { mediaId: "med_og" } } }, db);

			await setSiteSettings({ seo: { defaultOgImage: null } }, db);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.seo).toBeUndefined();
			expect(await new OptionsRepository(db).exists("site:seo")).toBe(false);
		});
		it("keeps the other SEO fields when updating one of them", async () => {
			await setSiteSettings(
				{
					seo: {
						titleSeparator: " | ",
						robotsTxt: "User-agent: *\nDisallow: /private/",
						googleVerification: "google-code",
					},
				},
				db,
			);

			await setSiteSettings({ seo: { googleVerification: "new-code" } }, db);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.seo).toEqual({
				titleSeparator: " | ",
				robotsTxt: "User-agent: *\nDisallow: /private/",
				googleVerification: "new-code",
			});
		});
		it("keeps the other social links when updating one of them", async () => {
			await setSiteSettings({ social: { twitter: "@handle", github: "user" } }, db);

			await setSiteSettings({ social: { github: "new-user" } }, db);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.social).toEqual({ twitter: "@handle", github: "new-user" });
		});
		it("rolls back updates when a media-setting deletion fails", async () => {
			await setSiteSettings({ title: "Original", logo: { mediaId: "med_logo" } }, db);
			await sql`
				CREATE TRIGGER block_site_logo_delete
				BEFORE DELETE ON options
				WHEN OLD.name = 'site:logo'
				BEGIN
					SELECT RAISE(ABORT, 'blocked delete');
				END
			`.execute(db);

			await expect(setSiteSettings({ title: "Changed", logo: null }, db)).rejects.toThrow();

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.title).toBe("Original");
			expect(settings.logo?.mediaId).toBe("med_logo");
		});
		it("should return undefined for unset values", async () => {
			const title = await getSiteSettingWithDb("title", db);
			expect(title).toBeUndefined();
		});
		it("should return the stored value", async () => {
			await setSiteSettings({ title: "My Site" }, db);
			const title = await getSiteSettingWithDb("title", db);
			expect(title).toBe("My Site");
		});
		it("should return numbers correctly", async () => {
			await setSiteSettings({ postsPerPage: 10 }, db);
			const postsPerPage = await getSiteSettingWithDb("postsPerPage", db);
			expect(postsPerPage).toBe(10);
		});
		it("should return nested objects", async () => {
			const social = { twitter: "@handle", github: "user" };
			await setSiteSettings({ social }, db);
			const retrieved = await getSiteSettingWithDb("social", db);
			expect(retrieved).toEqual(social);
		});
		it("should return empty object for no settings", async () => {
			const settings = await getSiteSettingsWithDb(db);
			expect(settings).toEqual({});
		});
		it("should return all settings", async () => {
			await setSiteSettings(
				{
					title: "Test",
					tagline: "Welcome",
					postsPerPage: 10,
				},
				db,
			);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.title).toBe("Test");
			expect(settings.tagline).toBe("Welcome");
			expect(settings.postsPerPage).toBe(10);
		});
		it("should return partial object for partial settings", async () => {
			await setSiteSettings({ title: "Test" }, db);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.title).toBe("Test");
			expect(settings.tagline).toBeUndefined();
		});
		it("should handle multiple setting types", async () => {
			await setSiteSettings(
				{
					title: "Test Site",
					postsPerPage: 15,
					dateFormat: "MMMM d, yyyy",
					timezone: "America/New_York",
					social: {
						twitter: "@test",
					},
				},
				db,
			);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.title).toBe("Test Site");
			expect(settings.postsPerPage).toBe(15);
			expect(settings.dateFormat).toBe("MMMM d, yyyy");
			expect(settings.timezone).toBe("America/New_York");
			expect(settings.social?.twitter).toBe("@test");
		});
		it("should store logo without URL", async () => {
			await setSiteSettings(
				{
					logo: { mediaId: "med_123", alt: "Logo" },
				},
				db,
			);

			// When retrieved without storage, should return mediaId but no URL
			const logo = await getSiteSettingWithDb("logo", db, null);
			expect(logo?.mediaId).toBe("med_123");
			expect(logo?.alt).toBe("Logo");
		});
		it("should store favicon without URL", async () => {
			await setSiteSettings(
				{
					favicon: { mediaId: "med_456" },
				},
				db,
			);

			const favicon = await getSiteSettingWithDb("favicon", db, null);
			expect(favicon?.mediaId).toBe("med_456");
		});
		it("returns seo settings unchanged when no defaultOgImage is set", async () => {
			await setSiteSettings(
				{
					seo: { titleSeparator: " — ", googleVerification: "g123" },
				},
				db,
			);

			const settings = await getSiteSettingsWithDb(db);
			expect(settings.seo?.titleSeparator).toBe(" — ");
			expect(settings.seo?.googleVerification).toBe("g123");
			expect(settings.seo?.defaultOgImage).toBeUndefined();
		});
});
