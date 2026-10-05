// Two separate Native D1 controls; Original85 files/config retain their5000ms clock.
// Same pinned Source callbacks/data/assertions, with Source Workerd30000ms deadline.
// Framework/native execution credit only: no Original85 timeout-fix credit.
import type {Kysely,KyselyPlugin,PluginTransformQueryArgs,PluginTransformResultArgs,QueryResult,RootOperationNode,UnknownRow} from 'kysely';
import {beforeEach,afterEach,expect,it} from 'vitest';
import {applySeedWithinBudget,type SeedApplyBudget,type SeedApplyProgress} from '../../src/lib/server/seed/index.ts';
import type {SeedFile} from '../../src/lib/server/seed/types.ts';
import type {Database} from '../../src/lib/server/seed/upstream/database/types.ts';
import {TaxonomyRepository} from '../../src/lib/server/taxonomies/repository.ts';
import {schemaAdminStorage} from '../helpers/schema-admin-storage.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {seedSourceDatabase} from '../../src/lib/server/seed/namespace.ts';
let db:Kysely<Database>,storage:Awaited<ReturnType<typeof schemaAdminStorage>>;
beforeEach(async()=>{storage=await schemaAdminStorage('D1');await migrateCms(storage.database);db=seedSourceDatabase(storage.database);});
afterEach(async()=>{await storage.close();});
class QueryCountingPlugin implements KyselyPlugin {
	count = 0;

	transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
		this.count += 1;
		return args.node;
	}

	transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
		return Promise.resolve(args.result);
	}
}

async function applyInCalls(
	db: Kysely<Database>,
	seed: SeedFile,
	budget: SeedApplyBudget,
): Promise<{ completed: boolean[]; queries: number[]; progress: SeedApplyProgress[] }> {
	const completed: boolean[] = [];
	const queries: number[] = [];
	const progress: SeedApplyProgress[] = [];
	for (let call = 0; call < 500; call++) {
		const counter = new QueryCountingPlugin();
		const outcome = await applySeedWithinBudget(
			db.withPlugin(counter),
			seed,
			{ includeContent: true },
			budget,
		);
		completed.push(outcome.complete);
		queries.push(counter.count);
		progress.push(outcome.progress);
		if (outcome.complete) return { completed, queries, progress };
	}
	throw new Error("The seed did not complete within 500 calls");
}

function plainSeed(collections: string[], entriesPerCollection: number): SeedFile {
	return {
		version: "1",
		collections: collections.map((slug) => ({
			slug,
			label: slug,
			fields: [{ slug: "title", label: "Title", type: "string" as const }],
		})),
		content: Object.fromEntries(
			collections.map((slug) => [
				slug,
				Array.from({ length: entriesPerCollection }, (_, index) => ({
					id: `${slug}-${index}`,
					slug: `${slug}-${index}`,
					data: { title: `Entry ${index}` },
				})),
			]),
		),
	};
}

it("keeps every call near its budget, however many entries earlier calls wrote",
async () => {
		const budget = 150;
		const seed = plainSeed(["pages", "posts", "events", "places"], 60);

		const { queries } = await applyInCalls(db, seed, { queries: budget });

		expect(queries.length).toBeGreaterThan(1);
		expect(Math.max(...queries)).toBeLessThanOrEqual(budget + 25);
		const rows = await db
			.selectFrom("ec_places" as never)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow();
		expect(rows.count).toBe(60);
	},30000);

it("keeps every call near its budget while it creates many terms and bylines",
async () => {
		const budget = 150;
		const seed: SeedFile = {
			...plainSeed(["posts"], 20),
			taxonomies: [
				{
					name: "tag",
					label: "Tags",
					hierarchical: false,
					collections: ["posts"],
					terms: Array.from({ length: 200 }, (_, index) => ({
						slug: `tag-${index}`,
						label: `Tag ${index}`,
					})),
				},
				{
					name: "category",
					label: "Categories",
					hierarchical: true,
					collections: ["posts"],
					terms: Array.from({ length: 200 }, (_, index) => ({
						slug: `category-${index}`,
						label: `Category ${index}`,
						...(index >= 10 ? { parent: `category-${index % 10}` } : {}),
					})),
				},
			],
			bylines: Array.from({ length: 200 }, (_, index) => ({
				id: `byline-${index}`,
				slug: `author-${index}`,
				displayName: `Author ${index}`,
			})),
		};

		const { queries, progress } = await applyInCalls(db, seed, { queries: budget });

		expect(queries.length).toBeGreaterThan(1);
		expect(Math.max(...queries)).toBeLessThanOrEqual(budget + 25);
		const done = progress.slice(0, -1).map((step) => step.done);
		expect(done.every((value, index) => index === 0 || value > done[index - 1]!)).toBe(true);
		expect(progress.at(-1)).toEqual({ done: 620, total: 620 });
		for (const [name, count] of [
			["tag", 200],
			["category", 200],
		] as const) {
			const rows = await db
				.selectFrom("taxonomies")
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.where("name", "=", name)
				.executeTakeFirstOrThrow();
			expect(rows.count).toBe(count);
		}
		const bylineRows = await db
			.selectFrom("_emdash_bylines")
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow();
		expect(bylineRows.count).toBe(200);
		const child = await new TaxonomyRepository(db).findBySlug("category", "category-199");
		const parent = await new TaxonomyRepository(db).findBySlug("category", "category-9");
		expect(child?.parentId).toBe(parent?.translationGroup);
	},30000);
