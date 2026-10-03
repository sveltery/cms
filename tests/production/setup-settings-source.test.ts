// @ts-nocheck -- complete immutable callback bodies; native transport host fixture.
// EmDash 1.1.0 / MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Native settings service adaptation of MCP callbacks; no MCP wire/registration or PAT credit.
import {describe,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {it,expect as baseExpect} from '../helpers/upstream-expect.ts';
function expect(actual) { const result=baseExpect(actual); result.toBeFalsy=()=>assert.equal(!actual,true); return result; }
import {Role} from '../../src/lib/server/auth/roles.ts';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
const ADMIN_ID='user_admin', EDITOR_ID='user_editor', SUBSCRIBER_ID='user_subscriber';
const roles = new Map([[Role.ADMIN,'admin'],[Role.EDITOR,'editor'],[Role.SUBSCRIBER,'subscriber']]);
function extractText(result) {return JSON.stringify(result);}
function extractJson(result) {return result.data;}
for (const target of ['Node','D1']) describe(`${target}: complete settings source service callbacks`,()=>{
 let db, h, harness;
 beforeEach(async()=>{h=await schemaAdminRemotes(target); db=h.database.db;});
 afterEach(async()=>{await h.close();});
 async function connectMcpHarness({userRole}) {
   return { client: { async callTool({name,arguments:input}) {
     const response = await h.request('/api/settings',roles.get(userRole),name==='settings_update'?{
       method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify(input)
     }:{});
     let payload;try{payload=await response.json();}catch{payload={error:{code:'NOT_FOUND'}};}
     return {isError:!response.ok,_meta:{code:payload.error?.code},data:payload.data??{}};
   }},cleanup:async()=>{}};
 }
	it("returns an empty object when no settings are set", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		const result = await harness.client.callTool({
			name: "settings_get",
			arguments: {},
		});
		expect(result.isError, extractText(result)).toBeFalsy();
		const data = extractJson<SiteSettingsResponse>(result);
		expect(data).toEqual({});
	});
	it("returns previously-set settings", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		await harness.client.callTool({
			name: "settings_update",
			arguments: { title: "My Site", tagline: "Welcome" },
		});

		const result = await harness.client.callTool({
			name: "settings_get",
			arguments: {},
		});
		expect(result.isError, extractText(result)).toBeFalsy();
		const data = extractJson<SiteSettingsResponse>(result);
		expect(data.title).toBe("My Site");
		expect(data.tagline).toBe("Welcome");
	});
	it("editor can read settings", async () => {
		harness = await connectMcpHarness({ db, userId: EDITOR_ID, userRole: Role.EDITOR });
		const result = await harness.client.callTool({
			name: "settings_get",
			arguments: {},
		});
		expect(result.isError, extractText(result)).toBeFalsy();
	});
	it("subscriber cannot read settings (INSUFFICIENT_PERMISSIONS)", async () => {
		harness = await connectMcpHarness({ db, userId: SUBSCRIBER_ID, userRole: Role.SUBSCRIBER });
		const result = await harness.client.callTool({
			name: "settings_get",
			arguments: {},
		});
		expect(result.isError).toBe(true);
		const meta = (result as { _meta?: { code?: string } })._meta;
		expect(meta?.code).toBe("INSUFFICIENT_PERMISSIONS");
	});
	it("updates title and tagline", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: { title: "EmDash Demo", tagline: "Hello" },
		});
		expect(result.isError, extractText(result)).toBeFalsy();
		const data = extractJson<SiteSettingsResponse>(result);
		expect(data.title).toBe("EmDash Demo");
		expect(data.tagline).toBe("Hello");
	});
	it("partial update preserves other fields", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		await harness.client.callTool({
			name: "settings_update",
			arguments: { title: "First", tagline: "Original tagline" },
		});

		// Update only tagline; title should be preserved
		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: { tagline: "Updated tagline" },
		});
		expect(result.isError, extractText(result)).toBeFalsy();
		const data = extractJson<SiteSettingsResponse>(result);
		expect(data.title).toBe("First");
		expect(data.tagline).toBe("Updated tagline");
	});
	it("accepts an http url and rejects javascript: scheme", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		const ok = await harness.client.callTool({
			name: "settings_update",
			arguments: { url: "https://example.com" },
		});
		expect(ok.isError, extractText(ok)).toBeFalsy();

		const bad = await harness.client.callTool({
			name: "settings_update",
			// eslint-disable-next-line no-script-url -- intentional for validation test
			arguments: { url: "javascript:alert(1)" },
		});
		expect(bad.isError).toBe(true);
	});
	it("accepts empty string for url (clears it)", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: { url: "" },
		});
		expect(result.isError, extractText(result)).toBeFalsy();
	});
	it("rejects out-of-range postsPerPage", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: { postsPerPage: 9999 },
		});
		expect(result.isError).toBe(true);
	});
	it("accepts nested seo and social objects", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: {
				social: { twitter: "@emdash", github: "emdash-cms" },
				seo: { titleSeparator: " | ", googleVerification: "abc123" },
			},
		});
		expect(result.isError, extractText(result)).toBeFalsy();
		const data = extractJson<SiteSettingsResponse>(result);
		expect(data.social?.twitter).toBe("@emdash");
		expect(data.social?.github).toBe("emdash-cms");
		expect((data.seo as { titleSeparator?: string }).titleSeparator).toBe(" | ");
	});
	it("removes media references while preserving sibling SEO settings", async () => {
		harness = await connectMcpHarness({ db, userId: ADMIN_ID, userRole: Role.ADMIN });
		await harness.client.callTool({
			name: "settings_update",
			arguments: {
				logo: { mediaId: "med_logo" },
				favicon: { mediaId: "med_favicon" },
				seo: {
					defaultOgImage: { mediaId: "med_og" },
					titleSeparator: " | ",
					googleVerification: "abc123",
				},
			},
		});

		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: { logo: null, favicon: null, seo: { defaultOgImage: null } },
		});
		expect(result.isError, extractText(result)).toBeFalsy();
		const data = extractJson<SiteSettingsResponse>(result);
		expect(data.logo).toBeUndefined();
		expect(data.favicon).toBeUndefined();
		expect(data.seo).toEqual({ titleSeparator: " | ", googleVerification: "abc123" });
	});
	it("editor cannot update settings (INSUFFICIENT_PERMISSIONS — admin only)", async () => {
		harness = await connectMcpHarness({ db, userId: EDITOR_ID, userRole: Role.EDITOR });
		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: { title: "Nope" },
		});
		expect(result.isError).toBe(true);
		const meta = (result as { _meta?: { code?: string } })._meta;
		expect(meta?.code).toBe("INSUFFICIENT_PERMISSIONS");
	});
	it("subscriber cannot update settings", async () => {
		harness = await connectMcpHarness({ db, userId: SUBSCRIBER_ID, userRole: Role.SUBSCRIBER });
		const result = await harness.client.callTool({
			name: "settings_update",
			arguments: { title: "Nope" },
		});
		expect(result.isError).toBe(true);
		const meta = (result as { _meta?: { code?: string } })._meta;
		expect(meta?.code).toBe("INSUFFICIENT_PERMISSIONS");
	});
});
