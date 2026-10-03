// @ts-nocheck -- complete immutable callback bodies; native counting storage fixture.
// EmDash1.1.0 MIT Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {describe,beforeEach,afterEach,it,expect} from 'vitest';
import {openSqlite} from '../../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {OptionsRepository} from '../../../src/lib/server/settings/options.ts';
import {runWithContext} from '../../../src/lib/server/settings/context.ts';
import {settingsDb,getSiteSettings,getSiteSetting,setSiteSettings,invalidateSiteSettingsCache} from '../../../src/lib/server/settings/index.ts';
const databases=[];
afterEach(async()=>{while(databases.length)await databases.pop().close();});
async function setupCountingDb(){
 const database=openSqlite(':memory:');databases.push(database);await migrateCms(database);
 const queries=[];
 const counted=database.db.withPlugin({transformQuery(args){queries.push(args.node.kind);return args.node;},transformResult(args){return Promise.resolve(args.result);}});
 // Count exact compiled SQL via a Kysely log-hook equivalent on the execute provider.
 const execute=counted.getExecutor().executeQuery.bind(counted.getExecutor());
 counted.getExecutor().executeQuery=async (...args)=>{queries.push(args[0].sql);return execute(...args);};
 const db=settingsDb(database,counted);
 return{db,queries,reset:()=>queries.splice(0,queries.length)};
}
describe('Complete pinned site settings cache callbacks',()=>{
 beforeEach(()=>invalidateSiteSettingsCache());
	it("getSiteSetting() does not hit the DB after getSiteSettings() in the same request", async () => {
		const { db, queries, reset } = await setupCountingDb();
		await setSiteSettings({ title: "Site", seo: { titleSeparator: " — " } }, db);

		await runWithContext({ editMode: false, db }, async () => {
			reset();
			const all = await getSiteSettings();
			expect(all.title).toBe("Site");
			const optionsQueriesAfterAll = queries.filter((q) => q.includes("options")).length;

			const seo = await getSiteSetting("seo");
			expect(seo?.titleSeparator).toBe(" — ");
			const optionsQueriesAfterSeo = queries.filter((q) => q.includes("options")).length;

			expect(optionsQueriesAfterSeo).toBe(optionsQueriesAfterAll);
		});
	});
	it("globalThis cache survives across requests within an isolate", async () => {
		const { db, queries, reset } = await setupCountingDb();
		await setSiteSettings({ title: "Cached Site" }, db);

		await runWithContext({ editMode: false, db }, async () => {
			const first = await getSiteSettings();
			expect(first.title).toBe("Cached Site");
		});

		reset();

		await runWithContext({ editMode: false, db }, async () => {
			const second = await getSiteSettings();
			expect(second.title).toBe("Cached Site");
		});

		const optionsQueries = queries.filter((q) => q.includes("options"));
		expect(optionsQueries).toEqual([]);
	});
	it("setSiteSettings() invalidates the globalThis cache", async () => {
		const { db, queries, reset } = await setupCountingDb();
		await setSiteSettings({ title: "Original" }, db);

		await runWithContext({ editMode: false, db }, async () => {
			const before = await getSiteSettings();
			expect(before.title).toBe("Original");
		});

		await setSiteSettings({ title: "Updated" }, db);

		reset();

		await runWithContext({ editMode: false, db }, async () => {
			const after = await getSiteSettings();
			expect(after.title).toBe("Updated");
		});

		const prefixScans = queries.filter((q) => q.includes("LIKE") && q.includes("options"));
		expect(prefixScans.length).toBe(1);
	});
	it("setSiteSettings() invalidates the cache even when the write throws", async () => {
		const { db, queries, reset } = await setupCountingDb();
		await setSiteSettings({ title: "Original" }, db);

		await runWithContext({ editMode: false, db }, async () => {
			await getSiteSettings();
		});

		const original = OptionsRepository.prototype.setMany;
		OptionsRepository.prototype.setMany = async () => {
			throw new Error("simulated partial-write failure");
		};

		try {
			await expect(setSiteSettings({ title: "Updated" }, db)).rejects.toThrow(
				"simulated partial-write failure",
			);
		} finally {
			OptionsRepository.prototype.setMany = original;
		}

		reset();

		await runWithContext({ editMode: false, db }, async () => {
			await getSiteSettings();
		});

		const prefixScans = queries.filter((q) => q.includes("LIKE") && q.includes("options"));
		expect(prefixScans.length).toBe(1);
	});
	it("invalidateSiteSettingsCache() drops the cached value", async () => {
		const { db, queries, reset } = await setupCountingDb();
		await setSiteSettings({ title: "First" }, db);

		await runWithContext({ editMode: false, db }, async () => {
			await getSiteSettings();
		});

		await db
			.updateTable("options")
			.set({ value: JSON.stringify("Second") })
			.where("name", "=", "site:title")
			.execute();

		reset();
		invalidateSiteSettingsCache();

		await runWithContext({ editMode: false, db }, async () => {
			const after = await getSiteSettings();
			expect(after.title).toBe("Second");
		});

		const prefixScans = queries.filter((q) => q.includes("LIKE") && q.includes("options"));
		expect(prefixScans.length).toBe(1);
	});
});
