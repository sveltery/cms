// @ts-nocheck -- complete pinned declarations, host fixtures adapted.
// EmDash913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { describe,beforeEach,afterEach } from 'node:test';
import { sql } from 'kysely';
import { it,expect } from './helpers/lifecycle-expect.ts';
import { setupLifecycleFixture,SchemaRegistry,ContentRepository,RevisionRepository } from './helpers/lifecycle-fixture.ts';
const dialect='sqlite';
describe("packages/core/tests/integration/content/blank-array-field.test.ts",()=>{let fixture,runtime,ctx,id;beforeEach(async()=>{fixture=await setupLifecycleFixture();runtime=fixture.runtime;ctx={db:fixture.database.db};const registry=new SchemaRegistry(ctx.db);await registry.createField('posts',{slug:'body',label:'Body',type:'portableText'});await registry.createField('posts',{slug:'tags',label:'Tags',type:'multiSelect'});await registry.createField('posts',{slug:'links',label:'Links',type:'repeater',validation:{subFields:[{slug:'label',type:'string',label:'Label'}]}});});afterEach(async()=>{await fixture.database.close();});
it("saves blank strings as null on create", async () => {
		const result = await runtime.handleContentCreate("posts", {
			slug: "p1",
			data: { title: "p1", body: "", tags: "  ", links: "" },
		});

		expect(result.success).toBe(true);
		if (!result.success) return;
		const row = await sql<Record<string, unknown>>`
			SELECT body, tags, links FROM ${sql.ref("ec_posts")} WHERE id = ${result.data.item.id}
		`.execute(ctx.db);
		expect(row.rows[0]).toEqual({ body: null, tags: null, links: null });
	});
it.skipIf(dialect === "postgres")(
		"saves an entry read back with a stored blank body",
		async () => {
			const created = await runtime.handleContentCreate("posts", {
				slug: "p2",
				data: { title: "p2" },
			});
			if (!created.success) throw new Error("setup failed");
			const { id } = created.data.item;
			await sql`UPDATE ${sql.ref("ec_posts")} SET body = ${""} WHERE id = ${id}`.execute(ctx.db);

			const loaded = await runtime.handleContentGet("posts", id);
			if (!loaded.success) throw new Error("load failed");
			expect(loaded.data.item.data.body).toBe("");

			const updated = await runtime.handleContentUpdate("posts", id, {
				data: { ...loaded.data.item.data, title: "p2 edited" },
			});

			expect(updated.success).toBe(true);
			if (!updated.success) return;
			expect(updated.data.item.data.body).toBeNull();
		},
	);
it("still rejects a blank body on a required field", async () => {
		const registry = new SchemaRegistry(ctx.db);
		await registry.createCollection({ slug: "pages", label: "Pages" });
		await registry.createField("pages", {
			slug: "body",
			label: "Body",
			type: "portableText",
			required: true,
		});

		const result = await runtime.handleContentCreate("pages", {
			slug: "p3",
			data: { body: "" },
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.details?.issues).toContainEqual(
			expect.objectContaining({ path: "body", code: "required" }),
		);
	});
});
describe("packages/core/tests/integration/content/deleted-field-stranded-entry.test.ts",()=>{let fixture,runtime,ctx,id;beforeEach(async()=>{fixture=await setupLifecycleFixture();runtime=fixture.runtime;ctx={db:fixture.database.db};const registry=new SchemaRegistry(ctx.db);await registry.createField('posts',{slug:'hits',label:'Hits',type:'integer'});const created=await runtime.handleContentCreate('posts',{slug:'p1',data:{title:'p1',hits:42}});if(!created.success)throw new Error('setup: create failed');id=created.data.item.id;const published=await runtime.handleContentPublish('posts',id);if(!published.success)throw new Error('setup: publish failed');const draft=await runtime.handleContentUpdate('posts',id,{data:{title:'p1 draft',hits:43}});if(!draft.success)throw new Error('setup: draft failed');await registry.deleteField('posts','hits');});afterEach(async()=>{await fixture.database.close();});
it("publishes the existing draft without another save", async () => {
			const before = await new ContentRepository(ctx.db).findById("posts", id);
			const draftRevisionId = before?.draftRevisionId;
			expect(draftRevisionId).toBeTruthy();

			const published = await runtime.handleContentPublish("posts", id);
			expect(published.success).toBe(true);
			if (!published.success) return;
			expect(published.data.item.status).toBe("published");
			expect(published.data.item.liveRevisionId).toBe(draftRevisionId);
			expect(published.data.item.draftRevisionId).toBeNull();
			expect(Object.hasOwn(published.data.item.data as Record<string, unknown>, "hits")).toBe(
				false,
			);

			const revision = await new RevisionRepository(ctx.db).findById(draftRevisionId!);
			expect(revision?.data).toEqual({ title: "p1 draft", hits: 43 });
		});
});
