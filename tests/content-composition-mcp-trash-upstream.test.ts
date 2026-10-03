// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Full source callbacks; service projection does not execute MCP protocol.
import {beforeEach,afterEach} from 'node:test';
import {expect,it,compositionFixture} from './helpers/content-composition-fixture.ts';
let fixture:any;let harness:any;
beforeEach(async()=>{fixture=await compositionFixture();harness=fixture.harness;});
afterEach(async()=>{await fixture.database.close();});
const extractJson=<T>(result:any):T=>result.structuredContent;
const extractText=(result:any)=>result.content[0].text;
const revOf=(result:any)=>result.structuredContent._rev;
it("content_get on a trashed item returns NOT_FOUND (not the item)", async () => {
		const created = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "T" } },
		});
		const id = extractJson<{ item: { id: string } }>(created).item.id;

		await harness.client.callTool({
			name: "content_delete",
			arguments: { collection: "post", id },
		});

		const got = await harness.client.callTool({
			name: "content_get",
			arguments: { collection: "post", id },
		});
		expect(got.isError).toBe(true);
		expect(extractText(got)).toMatch(/\bNOT_FOUND\b|\bnot found\b/i);
	});

it("content_list does NOT include trashed items by default", async () => {
		const a = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "Live" } },
		});
		const b = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "Trashed" } },
		});
		const trashedId = extractJson<{ item: { id: string } }>(b).item.id;

		await harness.client.callTool({
			name: "content_delete",
			arguments: { collection: "post", id: trashedId },
		});

		const list = await harness.client.callTool({
			name: "content_list",
			arguments: { collection: "post" },
		});
		const ids = extractJson<{ items: Array<{ id: string }> }>(list).items.map((i) => i.id);
		expect(ids).not.toContain(trashedId);
		expect(ids).toContain(extractJson<{ item: { id: string } }>(a).item.id);
	});

it("content_list_trashed returns only trashed items", async () => {
		await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "Live" } },
		});
		const b = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "Trashed" } },
		});
		await harness.client.callTool({
			name: "content_delete",
			arguments: {
				collection: "post",
				id: extractJson<{ item: { id: string } }>(b).item.id,
			},
		});

		const trashed = await harness.client.callTool({
			name: "content_list_trashed",
			arguments: { collection: "post" },
		});
		const items = extractJson<{ items: Array<{ id: string }> }>(trashed).items;
		expect(items).toHaveLength(1);
		expect(items[0]?.id).toBe(extractJson<{ item: { id: string } }>(b).item.id);
	});

it("content_update on a trashed item is rejected (item not visible)", async () => {
		const created = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "T" } },
		});
		const id = extractJson<{ item: { id: string } }>(created).item.id;
		// Read the token before the item goes to the trash; afterwards it is invisible.
		const rev = revOf(created);

		await harness.client.callTool({
			name: "content_delete",
			arguments: { collection: "post", id },
		});

		const updated = await harness.client.callTool({
			name: "content_update",
			arguments: {
				collection: "post",
				id,
				data: { title: "Edit while dead" },
				_rev: rev,
			},
		});
		expect(updated.isError).toBe(true);
		expect(extractText(updated)).toMatch(/\bNOT_FOUND\b|\bnot found\b|trash/i);
	});

it("content_publish on a trashed item is rejected", async () => {
		const created = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "T" } },
		});
		const id = extractJson<{ item: { id: string } }>(created).item.id;
		// Read the token before the item goes to the trash; afterwards it is invisible.
		const rev = revOf(created);

		await harness.client.callTool({
			name: "content_delete",
			arguments: { collection: "post", id },
		});

		const result = await harness.client.callTool({
			name: "content_publish",
			arguments: { collection: "post", id, _rev: rev },
		});
		expect(result.isError).toBe(true);
	});
