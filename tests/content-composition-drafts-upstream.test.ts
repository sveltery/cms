// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete source declarations; fixture/framework substitutions are in the ledger.
import {describe,beforeEach,afterEach} from 'node:test';
import {expect,it,compositionFixture} from './helpers/content-composition-fixture.ts';
let fixture:any;let harness:any;type ItemEnvelope={item:any;_rev?:string};
beforeEach(async()=>{fixture=await compositionFixture();harness=fixture.harness;});
afterEach(async()=>{await fixture.database.close();});
const extractJson=<T>(result:any):T=>result.structuredContent;const extractText=(result:any)=>result.content[0].text;
const currentRev=async(client:any,collection:string,id:string)=>(await client.callTool({name:'content_get',arguments:{collection,id}})).structuredContent._rev;
function readTitle(item:ItemEnvelope['item']):unknown {if(item.data&&typeof item.data==='object'&&'title'in item.data)return item.data.title;return item.title;}
it("content_update response data reflects the new title", async () => {
			const created = await harness.client.callTool({
				name: "content_create",
				arguments: { collection: "post", data: { title: "Original" } },
			});
			const createdItem = extractJson<ItemEnvelope>(created);

			const updated = await harness.client.callTool({
				name: "content_update",
				arguments: {
					collection: "post",
					id: createdItem.item.id,
					data: { title: "Updated" },
					_rev: await currentRev(harness.client, "post", createdItem.item.id),
				},
			});
			expect(updated.isError, extractText(updated)).toBeFalsy();
			const updatedItem = extractJson<ItemEnvelope>(updated);

			// Bug #2: today this returns "Original". After fix: "Updated".
			expect(readTitle(updatedItem.item)).toBe("Updated");
		});

it("content_get returns the latest draft data after update", async () => {
			const created = await harness.client.callTool({
				name: "content_create",
				arguments: { collection: "post", data: { title: "Original" } },
			});
			const createdItem = extractJson<ItemEnvelope>(created);

			await harness.client.callTool({
				name: "content_update",
				arguments: {
					collection: "post",
					id: createdItem.item.id,
					data: { title: "Updated via draft" },
					_rev: await currentRev(harness.client, "post", createdItem.item.id),
				},
			});

			const got = await harness.client.callTool({
				name: "content_get",
				arguments: { collection: "post", id: createdItem.item.id },
			});
			const gotItem = extractJson<ItemEnvelope>(got);

			expect(readTitle(gotItem.item)).toBe("Updated via draft");
		});

it("multiple sequential updates all reflect on read", async () => {
			const created = await harness.client.callTool({
				name: "content_create",
				arguments: { collection: "post", data: { title: "v1" } },
			});
			const id = extractJson<ItemEnvelope>(created).item.id;

			for (const title of ["v2", "v3", "v4"]) {
				await harness.client.callTool({
					name: "content_update",
					arguments: {
						collection: "post",
						id,
						data: { title },
						_rev: await currentRev(harness.client, "post", id),
					},
				});
			}

			const got = await harness.client.callTool({
				name: "content_get",
				arguments: { collection: "post", id },
			});
			expect(readTitle(extractJson<ItemEnvelope>(got).item)).toBe("v4");
		});

it("publishing a draft makes its data the new live data on read", async () => {
			const created = await harness.client.callTool({
				name: "content_create",
				arguments: { collection: "post", data: { title: "Original" } },
			});
			const id = extractJson<ItemEnvelope>(created).item.id;

			// Publish initial as live
			await harness.client.callTool({
				name: "content_publish",
				arguments: { collection: "post", id, _rev: await currentRev(harness.client, "post", id) },
			});

			// Update creates a draft revision
			const updated = await harness.client.callTool({
				name: "content_update",
				arguments: {
					collection: "post",
					id,
					data: { title: "Draft change" },
					_rev: await currentRev(harness.client, "post", id),
				},
			});
			const draftRevisionId = extractJson<ItemEnvelope>(updated).item.draftRevisionId;

			// Publish promotes draft to live
			const published = await harness.client.callTool({
				name: "content_publish",
				arguments: { collection: "post", id, _rev: await currentRev(harness.client, "post", id) },
			});
			const publishedItem = extractJson<ItemEnvelope>(published).item;

			const got = await harness.client.callTool({
				name: "content_get",
				arguments: { collection: "post", id },
			});
			expect(publishedItem.liveRevisionId).toBe(draftRevisionId);
			expect(publishedItem.draftRevisionId).toBeNull();
			expect(readTitle(extractJson<ItemEnvelope>(got).item)).toBe("Draft change");
		});

it("partial updates merge with current draft (only title changes, body preserved)", async () => {
			const created = await harness.client.callTool({
				name: "content_create",
				arguments: { collection: "post", data: { title: "T1", body: "B1" } },
			});
			const id = extractJson<ItemEnvelope>(created).item.id;

			await harness.client.callTool({
				name: "content_update",
				arguments: {
					collection: "post",
					id,
					data: { title: "T2" },
					_rev: await currentRev(harness.client, "post", id),
				},
			});

			const got = await harness.client.callTool({
				name: "content_get",
				arguments: { collection: "post", id },
			});
			const item = extractJson<ItemEnvelope>(got).item;

			expect(readTitle(item)).toBe("T2");
			// Read body the same way
			const body =
				item.data && typeof item.data === "object" && "body" in item.data
					? // eslint-disable-next-line typescript/no-unsafe-type-assertion -- shape narrowed by 'in' check
						(item.data as { body?: unknown }).body
					: (item as Record<string, unknown>).body;
			expect(body).toBe("B1");
		});

it("content_update on collection without revisions support reflects on read", async () => {
			const created = await harness.client.callTool({
				name: "content_create",
				arguments: { collection: "page", data: { title: "Page A" } },
			});
			const id = extractJson<ItemEnvelope>(created).item.id;

			await harness.client.callTool({
				name: "content_update",
				arguments: {
					collection: "page",
					id,
					data: { title: "Page A Updated" },
					_rev: await currentRev(harness.client, "page", id),
				},
			});

			const got = await harness.client.callTool({
				name: "content_get",
				arguments: { collection: "page", id },
			});
			expect(readTitle(extractJson<ItemEnvelope>(got).item)).toBe("Page A Updated");
		});

it("liveData is undefined when there is no draft revision", async () => {
		const created = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "First" } },
		});
		const id = extractJson<{ item: { id: string } }>(created).item.id;

		const got = await harness.client.callTool({
			name: "content_get",
			arguments: { collection: "post", id },
		});
		const item = extractJson<{
			item: { data: { title: string }; liveData?: { title?: string } };
		}>(got).item;
		expect(item.data.title).toBe("First");
		expect(item.liveData).toBeUndefined();
	});

it("liveData carries the published values when a draft revision exists", async () => {
		// Create + publish, so the live value is "published title".
		const created = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "published title" } },
		});
		const id = extractJson<{ item: { id: string } }>(created).item.id;
		await harness.client.callTool({
			name: "content_publish",
			arguments: { collection: "post", id, _rev: await currentRev(harness.client, "post", id) },
		});

		// Update writes a draft revision (data column stays at "published title").
		await harness.client.callTool({
			name: "content_update",
			arguments: {
				collection: "post",
				id,
				data: { title: "draft title" },
				_rev: await currentRev(harness.client, "post", id),
			},
		});

		// Read back: data reflects the draft, liveData carries the published value.
		const got = await harness.client.callTool({
			name: "content_get",
			arguments: { collection: "post", id },
		});
		const item = extractJson<{
			item: { data: { title: string }; liveData?: { title?: string } };
		}>(got).item;
		expect(item.data.title).toBe("draft title");
		expect(item.liveData?.title).toBe("published title");
	});