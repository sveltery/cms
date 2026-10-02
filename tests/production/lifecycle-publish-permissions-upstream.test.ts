// @ts-nocheck -- complete pinned source callbacks; native HTTP host adapted.
// EmDash913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {describe,beforeEach,afterEach} from 'node:test';
import {it,expect} from '../helpers/lifecycle-expect.ts';
import {persistedRemotes} from '../helpers/persisted-remotes.ts';
import {lifecycleMigration} from '../../src/lib/server/database/lifecycle-migrations.ts';
import {Role} from '../../src/lib/server/auth/roles.ts';
import {parse} from 'devalue';
import {sql} from 'kysely';
const ADMIN_ID='user_admin',AUTHOR_ID='user_author';
const resultText=result=>result.content.filter(value=>value.type==='text').map(value=>value.text).join('\n');
function extractText(result){return resultText(result);}
function extractJson(result){if(result.isError)throw Error(`Expected success but got error: ${extractText(result)}`);return JSON.parse(extractText(result));}
function isErrorResult(result){return result.isError===true;}
const currentRev=async(client,collection,id)=>extractJson(await client.callTool({name:'content_get',arguments:{collection,id}}))._rev;
let fixture,db,harness;
async function connectMcpHarness({userId}) {
  const session=userId===AUTHOR_ID?'author':'admin';
  return {cleanup:async()=>{},client:{async callTool({name,arguments:argument}) {
    const remoteName={content_create:'createContent',content_get:'getLifecycleContent',content_publish:'publishContent'}[name];
    const {data,...rest}=argument;
    const envelope=await fixture.remote(remoteName,session,name==='content_get'?undefined:{...rest,...(data===undefined?{}:{data:JSON.stringify(data)})},name==='content_get'?rest:undefined);
    if(envelope.type==='error')return {isError:true,content:[{type:'text',text:`${envelope.error.code}: ${envelope.error.message}`}]};
    const value=parse(envelope.data)._;
    if(value.issues?.length)return {isError:true,content:[{type:'text',text:JSON.stringify(value.issues)}]};
    const item=name==='content_get'?value:await fixture.query('getLifecycleContent',{collection:argument.collection,id:value.result.id},session);
    return {content:[{type:'text',text:JSON.stringify({item,_rev:item._rev})}]};
  }}};
}
describe('complete pinned MCP publication callbacks through native HTTP',()=>{
 beforeEach(async()=>{fixture=await persistedRemotes({persistedSessions:true,mutationsEnabled:true});db=fixture.database.db;const installed=(await sql`SELECT name FROM sqlite_master WHERE name='_cms_revisions'`.execute(db)).rows.length;if(!installed)await fixture.database.atomicBatch(await lifecycleMigration.statements(fixture.database));harness=await connectMcpHarness({db,userId:ADMIN_ID,userRole:Role.ADMIN});});
 afterEach(async()=>{await harness.cleanup();await fixture.close();});
it.each(["2020-01-15T10:00:00.000Z", "2020-01-15T10:00Z", "2020-01-15T11:00+01:00"])(
		"backdates publishedAt from %s",
		async (publishedAt) => {
			const created = await harness.client.callTool({
				name: "content_create",
				arguments: { collection: "post", data: { title: "Imported post" } },
			});
			const id = extractJson<{ item: { id: string } }>(created).item.id;

			const PAST = "2020-01-15T10:00:00.000Z";
			const result = await harness.client.callTool({
				name: "content_publish",
				arguments: {
					collection: "post",
					id,
					publishedAt,
					_rev: await currentRev(harness.client, "post", id),
				},
			});
			expect(result.isError, extractText(result)).toBeFalsy();

			const item = extractJson<{ item: { publishedAt: string | null; status: string } }>(
				result,
			).item;
			expect(item.status).toBe("published");
			// Repository normalizes to ISO so we compare via Date round-trip.
			expect(new Date(item.publishedAt!).toISOString()).toBe(PAST);
		},
	);
it("requires content:publish_any to set publishedAt — AUTHOR (owner) is denied", async () => {
		// Switch to AUTHOR role: AUTHOR has publish_own but NOT publish_any.
		await harness.cleanup();
		harness = await connectMcpHarness({ db, userId: AUTHOR_ID, userRole: Role.AUTHOR });

		const created = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "Author's post" } },
		});
		const id = extractJson<{ item: { id: string } }>(created).item.id;

		// Plain publish (no publishedAt) — AUTHOR can do this for their own item.
		const ok = await harness.client.callTool({
			name: "content_publish",
			arguments: { collection: "post", id, _rev: await currentRev(harness.client, "post", id) },
		});
		expect(ok.isError, extractText(ok)).toBeFalsy();

		// Publish with backdated publishedAt — AUTHOR is denied even on their
		// own item, because backdating overwrites historical record.
		const denied = await harness.client.callTool({
			name: "content_publish",
			arguments: {
				collection: "post",
				id,
				publishedAt: "2020-01-01T00:00:00.000Z",
				_rev: await currentRev(harness.client, "post", id),
			},
		});
		expect(isErrorResult(denied)).toBe(true);
		expect(extractText(denied)).toContain("INSUFFICIENT_PERMISSIONS");
		expect(extractText(denied).toLowerCase()).toContain("publish_any");
	});
it("AUTHOR cannot publish someone else's item with publishedAt (ownership denies first)", async () => {
		// First create as ADMIN so the item belongs to a different user.
		const created = await harness.client.callTool({
			name: "content_create",
			arguments: { collection: "post", data: { title: "Admin's post" } },
		});
		const id = extractJson<{ item: { id: string } }>(created).item.id;

		// Switch to AUTHOR — now they're not the owner.
		await harness.cleanup();
		harness = await connectMcpHarness({ db, userId: AUTHOR_ID, userRole: Role.AUTHOR });

		const denied = await harness.client.callTool({
			name: "content_publish",
			arguments: {
				collection: "post",
				id,
				publishedAt: "2020-01-01T00:00:00.000Z",
				_rev: await currentRev(harness.client, "post", id),
			},
		});
		// Whichever check fires first (ownership or publishedAt gate), the
		// denial is the correct outcome. We pin the structural failure shape,
		// not the specific code, because either order is correct.
		expect(isErrorResult(denied)).toBe(true);
		expect(extractText(denied)).toContain("INSUFFICIENT_PERMISSIONS");
	});
});
